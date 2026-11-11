import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, createUser } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const generateText = vi.hoisted(() => vi.fn());
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText }));

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { decryptSecret } = await import("@/lib/crypto");
const { getAiModel, runAi } = await import("@/lib/ai");
const orgActions = await import("@/modules/organizations/server/actions");
const actions = await import("@/modules/connectors/server/actions");
const { listConnectors } = await import("@/modules/connectors/server/queries");

const KEY = "sk-live-SUPERSECRETKEY-1234567890";
const profile = {
  name: "Org X",
  timezone: "Asia/Jakarta",
  defaultCurrency: "IDR",
  dateFormat: "dd/MM/yyyy",
} as const;

async function makeOrg(name: string) {
  const owner = await createUser(name);
  actAs(owner);
  const res = await orgActions.createOrganizationAction({ ...profile, name });
  if (!res.ok) throw new Error(res.error);
  return { owner, orgId: res.data.id };
}

beforeEach(async () => {
  await resetDb();
  generateText.mockReset();
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Connector Hub — BYOK AI", () => {
  it("key tersimpan terenkripsi, tidak muncul di response, audit log, maupun tabel lain", async () => {
    const { orgId } = await makeOrg("Org A");
    const saved = await actions.saveAiConnector({
      provider: "openai",
      apiKey: KEY,
      model: "gpt-4.1-mini",
    });
    expect(saved, JSON.stringify(saved)).toMatchObject({ ok: true });
    expect(JSON.stringify(saved)).not.toContain(KEY);

    const row = await testPrisma.tenantConnector.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    expect(row.configEncrypted).not.toContain(KEY);
    expect(row.maskedHint).toBe("sk-...7890");
    expect(JSON.parse(decryptSecret(row.configEncrypted, `${orgId}:ai_openai`))).toEqual({
      apiKey: KEY,
    });
    expect(row.isDefault).toBe(true);

    const ctx = (await getTenantContext())!;
    const listed = JSON.stringify(await listConnectors(ctx));
    expect(listed).not.toContain(KEY);
    expect(listed).not.toContain(row.configEncrypted);
    expect(listed).not.toContain("configEncrypted");

    const audits = JSON.stringify(
      await testPrisma.auditLog.findMany({ where: { organizationId: orgId } }),
    );
    expect(audits).not.toContain(KEY);
    expect(audits).not.toContain("SUPERSECRETKEY");
    expect(audits).toContain("connector.created");
  });

  it("mengubah model tanpa key mempertahankan key lama", async () => {
    const { orgId } = await makeOrg("Org A");
    await actions.saveAiConnector({ provider: "gemini", apiKey: KEY, model: "gemini-2.5-flash" });
    await actions.saveAiConnector({ provider: "gemini", model: "gemini-2.5-pro" });
    const row = await testPrisma.tenantConnector.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    expect((row.settings as { model: string }).model).toBe("gemini-2.5-pro");
    expect(JSON.parse(decryptSecret(row.configEncrypted, `${orgId}:ai_gemini`)).apiKey).toBe(KEY);
  });

  it("tanpa key pada connector baru ditolak", async () => {
    await makeOrg("Org A");
    expect((await actions.saveAiConnector({ provider: "openai", model: "x" })).ok).toBe(false);
  });

  it("terisolasi per tenant: connector A tak terlihat B dan ciphertext A tak bisa didekripsi sebagai B", async () => {
    const a = await makeOrg("Org A");
    await actions.saveAiConnector({ provider: "openai", apiKey: KEY, model: "m" });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const ctxB = (await getTenantContext())!;
    expect(await listConnectors(ctxB)).toEqual([]);
    await expect(getAiModel(b.orgId)).rejects.toMatchObject({ code: "ai_not_configured" });
    expect(await actions.removeAiConnector({ provider: "openai" })).toMatchObject({ ok: false });
    const rowA = await testPrisma.tenantConnector.findFirstOrThrow({
      where: { organizationId: a.orgId },
    });
    expect(() => decryptSecret(rowA.configEncrypted, `${b.orgId}:ai_openai`)).toThrow();
    // salin ciphertext A ke B tidak berguna
    await testPrisma.tenantConnector.create({
      data: { organizationId: b.orgId, type: "ai_openai", configEncrypted: rowA.configEncrypted },
    });
    await expect(getAiModel(b.orgId)).rejects.toBeTruthy();
  });

  it("hanya Owner/Admin yang boleh mengelola; role lain ditolak", async () => {
    const { orgId } = await makeOrg("Org A");
    await actions.saveAiConnector({ provider: "openai", apiKey: KEY, model: "m" });
    const rep = await createUser("Rep");
    await testPrisma.member.create({
      data: { organizationId: orgId, userId: rep.id, role: "sales_rep" },
    });
    await testPrisma.session.updateMany({
      where: { userId: rep.id },
      data: { activeOrganizationId: orgId },
    });
    actAs(rep);
    expect(await actions.saveAiConnector({ provider: "gemini", apiKey: KEY, model: "m" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    expect(await actions.testAiConnector({ provider: "openai" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    expect(await actions.removeAiConnector({ provider: "openai" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    await expect(listConnectors((await getTenantContext())!)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("Test Connection: sukses untuk key valid, pesan jelas untuk key invalid tanpa membocorkan key", async () => {
    await makeOrg("Org A");
    await actions.saveAiConnector({ provider: "openai", apiKey: KEY, model: "gpt-4.1-mini" });

    generateText.mockResolvedValueOnce({ text: "pong" });
    const ok = await actions.testAiConnector({ provider: "openai" });
    expect(ok).toEqual({ ok: true, data: { ok: true } });

    generateText.mockRejectedValueOnce(
      Object.assign(new Error(`Incorrect API key provided: ${KEY}`), { statusCode: 401 }),
    );
    const bad = await actions.testAiConnector({ provider: "openai" });
    expect(bad).toMatchObject({ ok: true, data: { ok: false } });
    expect(JSON.stringify(bad)).not.toContain(KEY);
    expect(JSON.stringify(bad)).toMatch(/ditolak/);

    generateText.mockRejectedValueOnce(Object.assign(new Error(`bad ${KEY}`), { statusCode: 418 }));
    const odd = await actions.testAiConnector({ provider: "openai" });
    expect(JSON.stringify(odd)).not.toContain(KEY);

    const row = await testPrisma.tenantConnector.findFirstOrThrow({});
    expect(row.status).toBe("error");
    expect(row.lastTestError).not.toContain(KEY);
  });

  it("default: connector pertama default, hapus default memindahkan default, getAiModel memakai default", async () => {
    const { orgId } = await makeOrg("Org A");
    await actions.saveAiConnector({ provider: "openai", apiKey: KEY, model: "gpt-x" });
    await actions.saveAiConnector({
      provider: "anthropic",
      apiKey: "sk-ant-abcdefghijkl",
      model: "claude-x",
    });
    expect((await getAiModel(orgId)).provider).toBe("openai");
    await actions.setDefaultAiConnector({ provider: "anthropic" });
    const ai = await getAiModel(orgId);
    expect(ai.provider).toBe("anthropic");
    expect(ai.modelId).toBe("claude-x");
    await actions.removeAiConnector({ provider: "anthropic" });
    expect((await getAiModel(orgId)).provider).toBe("openai");
  });

  it("runAi mencatat metadata saja (tanpa isi prompt/response) dan error tidak membocorkan key", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    await actions.saveAiConnector({ provider: "openai", apiKey: KEY, model: "gpt-x" });
    await runAi(
      { organizationId: orgId, userId: owner.id },
      "test.feature",
      async () => "RAHASIA-ISI-RESPONSE",
    );
    await expect(
      runAi({ organizationId: orgId }, "test.feature", async () => {
        throw Object.assign(new Error(`oops ${KEY}`), { statusCode: 500 });
      }),
    ).rejects.toMatchObject({ code: "ai_failed" });
    const logs = await testPrisma.aiCallLog.findMany({ where: { organizationId: orgId } });
    expect(logs.map((l) => l.status).sort()).toEqual(["error", "ok"]);
    expect(Object.keys(logs[0]).sort()).toEqual([
      "createdAt",
      "durationMs",
      "feature",
      "id",
      "model",
      "organizationId",
      "provider",
      "status",
      "userId",
    ]);
    expect(JSON.stringify(logs)).not.toContain("RAHASIA");
    expect(JSON.stringify(logs)).not.toContain(KEY);
  });
});
