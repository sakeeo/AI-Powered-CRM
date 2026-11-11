import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const generateText = vi.hoisted(() => vi.fn());
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText }));

const { redis } = await import("@/lib/redis");
const importActions = await import("@/modules/import-export/server/actions");
const { buildDataset, renderCsv, renderXlsx } =
  await import("@/modules/import-export/server/export");
const { getTenantContext } = await import("@/lib/context");
const { guessMapping, applyMapping, validateLeadRow } =
  await import("@/modules/import-export/mapping");
const webhookActions = await import("@/modules/webhooks/server/actions");
const { signPayload } = await import("@/modules/webhooks/server/receive");
const { POST } = await import("@/app/api/webhooks/inbound/[publicId]/route");
const leadActions = await import("@/modules/leads/server/actions");
const connectorActions = await import("@/modules/connectors/server/actions");
const aiActions = await import("@/modules/leads/server/ai-actions");

beforeEach(async () => {
  await resetDb();
  generateText.mockReset();
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Mapping & validasi baris impor (unit)", () => {
  it("menebak kolom dari header Indonesia/Inggris dan menormalkan urgensi", () => {
    const m = guessMapping([
      "Nama",
      "E-mail",
      "Telp",
      "Perusahaan",
      "Anggaran",
      "Prioritas",
      "Lain",
    ]);
    expect(m).toMatchObject({
      name: "Nama",
      email: "E-mail",
      phone: "Telp",
      companyName: "Perusahaan",
      budget: "Anggaran",
      urgency: "Prioritas",
    });
    expect(applyMapping({ Nama: "Budi", Lain: "x" }, m)).toEqual({ name: "Budi" });
    expect(validateLeadRow({ name: "Budi", urgency: "Tinggi" })).toMatchObject({
      success: true,
      data: { urgency: "high" },
    });
    expect(validateLeadRow({ name: "B" }).success).toBe(false);
  });
});

describe("Impor lead", () => {
  it("baris valid disimpan, baris invalid dilaporkan dengan nomor baris", async () => {
    const { orgId } = await makeOrg("Org A");
    const res = await importActions.importLeadsBatch({
      startRow: 2,
      rows: [
        { name: "Andi", email: "andi@x.com", budget: "1.500.000" },
        { name: "Budi", email: "bukan-email" },
        { name: "Citra", phone: "0812-111-222", budget: "2500000.50", urgency: "Sedang" },
        { name: "" },
      ],
    });
    expect(res).toMatchObject({ ok: true, data: { created: 1 } });
    // "1.500.000" bukan format valid (titik ribuan) → ditolak; hanya Citra masuk.
    if (!res.ok) throw new Error();
    expect(res.data.errors.map((e) => e.row)).toEqual([2, 3, 5]);
    const leads = await testPrisma.lead.findMany({ where: { organizationId: orgId } });
    expect(leads.map((l) => l.name)).toEqual(["Citra"]);
    expect(leads[0].budget?.toFixed(2)).toBe("2500000.50");
    expect(leads[0].phoneNormalized).toBe("62812111222");
    expect(await testPrisma.auditLog.count({ where: { action: "lead.imported" } })).toBe(1);
  });

  it("1.000 baris diimpor lewat batch tanpa kehilangan data", async () => {
    const { orgId } = await makeOrg("Org A");
    const all = Array.from({ length: 1000 }, (_, i) => ({
      name: `Lead ${i}`,
      email: `l${i}@x.com`,
    }));
    let created = 0;
    for (let i = 0; i < all.length; i += 200) {
      const r = await importActions.importLeadsBatch({
        rows: all.slice(i, i + 200),
        startRow: i + 2,
      });
      if (!r.ok) throw new Error(r.error);
      created += r.data.created;
    }
    expect(created).toBe(1000);
    expect(await testPrisma.lead.count({ where: { organizationId: orgId } })).toBe(1000);
  });

  it("Sales Rep selalu menjadi owner; Viewer tidak boleh impor; sumber tak valid ditolak", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(orgId, "viewer", "Viewer");
    actAs(rep);
    const ownerOther = owner.id;
    const r = await importActions.importLeadsBatch({
      rows: [{ name: "Milik Rep" }],
      startRow: 2,
      ownerId: ownerOther,
    });
    expect(r.ok).toBe(true);
    expect((await testPrisma.lead.findFirst({ where: { name: "Milik Rep" } }))?.ownerId).toBe(
      rep.id,
    );
    actAs(viewer);
    expect(
      await importActions.importLeadsBatch({ rows: [{ name: "X Viewer" }], startRow: 2 }),
    ).toMatchObject({ ok: false });
    actAs(owner);
    expect(
      await importActions.importLeadsBatch({
        rows: [{ name: "Y" }],
        startRow: 2,
        sourceId: "00000000-0000-4000-8000-000000000000",
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("Export", () => {
  it("menghormati filter, menetralkan formula injection, dan menghasilkan CSV/XLSX", async () => {
    await makeOrg("Org A");
    await leadActions.createLead({ name: '=HYPERLINK("x")', email: "a@x.com" });
    const b = await leadActions.createLead({ name: "Budi Biasa" });
    if (!b.ok) throw new Error();
    await leadActions.setLeadStatus({ id: b.data.id, status: "contacted" });
    const ctx = (await getTenantContext())!;

    const all = await buildDataset(ctx, "leads", {});
    expect(all.rows).toHaveLength(2);
    const filtered = await buildDataset(ctx, "leads", { status: "contacted" });
    expect(filtered.rows.map((r) => r[0])).toEqual(["Budi Biasa"]);
    expect(all.rows.map((r) => r[0])).toContain('\'=HYPERLINK("x")');

    expect(await renderCsv(all)).toContain("Nama,Email");
    const xlsx = await renderXlsx(all, "leads");
    expect(xlsx.subarray(0, 2).toString()).toBe("PK"); // zip
    expect((await buildDataset(ctx, "contacts", {})).rows).toEqual([]);
    expect((await buildDataset(ctx, "companies", {})).rows).toEqual([]);
  });

  it("Sales Rep & Viewer tidak boleh export", async () => {
    const { orgId } = await makeOrg("Org A");
    for (const role of ["sales_rep", "viewer"] as const) {
      actAs(await addUserWithRole(orgId, role, role));
      const ctx = (await getTenantContext())!;
      await expect(buildDataset(ctx, "leads", {})).rejects.toMatchObject({ status: 403 });
      await expect(buildDataset(ctx, "contacts", {})).rejects.toMatchObject({ status: 403 });
    }
  });
});

describe("Webhook masuk", () => {
  async function setup() {
    const { orgId, owner } = await makeOrg("Org A");
    const g = await webhookActions.generateWebhook({});
    if (!g.ok) throw new Error(g.error);
    return { orgId, owner, ...g.data };
  }
  const call = (publicId: string, body: string, signature?: string) =>
    POST(
      new NextRequest(`http://localhost/api/webhooks/inbound/${publicId}`, {
        method: "POST",
        body,
        headers: signature ? { "x-signature": signature } : {},
      }),
      { params: Promise.resolve({ publicId }) },
    );

  it("signature sah → lead sumber Website; secret hanya tersimpan terenkripsi", async () => {
    const { orgId, publicId, secret } = await setup();
    const body = JSON.stringify({
      name: "Dewi Website",
      email: "dewi@x.com",
      message: "Butuh demo",
      company: "PT Web",
    });
    const res = await call(publicId, body, `sha256=${signPayload(secret, body)}`);
    expect(res.status).toBe(201);
    const lead = await testPrisma.lead.findFirst({
      where: { organizationId: orgId },
      include: { source: true },
    });
    expect(lead).toMatchObject({
      name: "Dewi Website",
      needs: "Butuh demo",
      companyName: "PT Web",
      ownerId: null,
    });
    expect(lead?.source?.name).toBe("Website");
    const row = await testPrisma.inboundWebhook.findFirstOrThrow();
    expect(row.secretEncrypted).not.toContain(secret);
    expect(await testPrisma.webhookDelivery.count({ where: { status: "accepted" } })).toBe(1);
  });

  it("menolak signature salah/hilang, payload invalid, webhook nonaktif, id tak dikenal", async () => {
    const { orgId, publicId, secret } = await setup();
    const body = JSON.stringify({ name: "Hacker" });
    expect((await call(publicId, body, "sha256=deadbeef")).status).toBe(401);
    expect((await call(publicId, body)).status).toBe(401);
    expect((await call(publicId, body, signPayload("whsec_lain", body))).status).toBe(401);
    const bad = JSON.stringify({ name: "X", email: "bukan-email" });
    expect((await call(publicId, bad, signPayload(secret, bad))).status).toBe(422);
    expect((await call(publicId, "bukan json", signPayload(secret, "bukan json"))).status).toBe(
      400,
    );
    expect(await testPrisma.lead.count({ where: { organizationId: orgId } })).toBe(0);

    await webhookActions.toggleWebhook({ isActive: false });
    expect((await call(publicId, body, signPayload(secret, body))).status).toBe(403);
    expect((await call("tidak-ada", body)).status).toBe(404);
    const statuses = (await testPrisma.webhookDelivery.findMany()).map((d) => d.status);
    expect(statuses).toEqual(
      expect.arrayContaining(["invalid_signature", "invalid_payload", "inactive"]),
    );
    expect(await testPrisma.lead.count()).toBe(0);
  });

  it("rotasi secret membatalkan secret lama; hanya yang berizin yang boleh mengelola", async () => {
    const { orgId, publicId, secret } = await setup();
    const rotated = await webhookActions.generateWebhook({});
    if (!rotated.ok) throw new Error();
    expect(rotated.data.publicId).toBe(publicId);
    const body = JSON.stringify({ name: "Setelah Rotasi" });
    expect((await call(publicId, body, signPayload(secret, body))).status).toBe(401);
    expect((await call(publicId, body, signPayload(rotated.data.secret, body))).status).toBe(201);
    actAs(await addUserWithRole(orgId, "sales_rep", "Rep"));
    expect(await webhookActions.generateWebhook({})).toMatchObject({ ok: false });
  });

  it("rate limit membatasi lonjakan permintaan", async () => {
    const { publicId, secret } = await setup();
    const body = JSON.stringify({ name: "Spam Lead" });
    const sig = signPayload(secret, body);
    let last = 0;
    for (let i = 0; i < 62; i++) last = (await call(publicId, body, sig)).status;
    expect(last).toBe(429);
  });
});

describe("AI Text-to-Lead", () => {
  it("hanya mengembalikan draf yang disanitasi dan tidak menulis ke tabel lead", async () => {
    await makeOrg("Org A");
    await connectorActions.saveAiConnector({
      provider: "openai",
      apiKey: "sk-test-1234567890",
      model: "gpt-4.1-mini",
    });
    generateText.mockResolvedValue({
      output: {
        name: "Budi Santoso",
        email: "ngawur",
        phone: "0812-3456-7890",
        companyName: "PT Maju",
        needs: "Sistem kasir 5 outlet",
        budget: "20000000",
        currency: null,
        urgency: "high",
        notes: null,
      },
    });
    const res = await aiActions.draftLeadFromText({
      text: "Halo saya Budi dari PT Maju, butuh sistem kasir 5 outlet budget 20jt",
    });
    expect(res).toMatchObject({
      ok: true,
      data: { name: "Budi Santoso", phone: "0812-3456-7890", budget: "20000000", urgency: "high" },
    });
    if (!res.ok) throw new Error();
    expect(res.data).not.toHaveProperty("email"); // email tidak valid dibuang
    expect(await testPrisma.lead.count()).toBe(0);
    expect(
      await testPrisma.aiCallLog.count({ where: { feature: "lead_text_to_lead", status: "ok" } }),
    ).toBe(1);
    // Log AI hanya metadata — tidak memuat isi teks.
    expect(JSON.stringify(await testPrisma.aiCallLog.findMany())).not.toContain("Budi");
  });

  it("menolak teks terlalu pendek/panjang, tanpa connector AI, dan peran tanpa izin buat lead", async () => {
    const { orgId } = await makeOrg("Org A");
    expect(await aiActions.draftLeadFromText({ text: "pendek" })).toMatchObject({ ok: false });
    expect(await aiActions.draftLeadFromText({ text: "x".repeat(9000) })).toMatchObject({
      ok: false,
    });
    expect(
      await aiActions.draftLeadFromText({ text: "Teks yang cukup panjang untuk diproses" }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("AI connector") });
    actAs(await addUserWithRole(orgId, "viewer", "V"));
    expect(
      await aiActions.draftLeadFromText({ text: "Teks yang cukup panjang untuk diproses" }),
    ).toMatchObject({ ok: false });
    expect(generateText).not.toHaveBeenCalled();
  });
});
