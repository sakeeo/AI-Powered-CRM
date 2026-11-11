import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const generateText = vi.hoisted(() => vi.fn());
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText }));

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const ai = await import("@/modules/activities/server/ai-actions");
const actions = await import("@/modules/activities/server/actions");
const q = await import("@/modules/activities/server/queries");
const connectorActions = await import("@/modules/connectors/server/actions");
const leadActions = await import("@/modules/leads/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const NOTES = "Meeting dengan Pak Budi: setuju demo Jumat depan, kirim proposal sebelum Rabu.";

beforeEach(async () => {
  await resetDb();
  generateText.mockReset();
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

async function setup() {
  const org = await makeOrg("Org A");
  await connectorActions.saveAiConnector({
    provider: "openai",
    apiKey: "sk-test-1234567890",
    model: "gpt-4.1-mini",
  });
  const leadId = idOf(await leadActions.createLead({ name: "Pak Budi", phone: "0812-3456-7890" }));
  return { ...org, leadId };
}
const snapshot = async () => ({
  activities: await testPrisma.activity.count(),
  leads: await testPrisma.lead.count(),
});

describe("Safe AI untuk aktivitas — hanya draf", () => {
  it("Summarizer mengembalikan ringkasan sebagai draf tanpa menyimpan apa pun", async () => {
    await setup();
    const before = await snapshot();
    generateText.mockResolvedValue({ output: { summary: "Paragraf satu.\n\nParagraf dua." } });
    const res = await ai.aiSummarizeNotes({ text: NOTES });
    expect(res).toMatchObject({ ok: true, data: { summary: "Paragraf satu.\n\nParagraf dua." } });
    expect(await snapshot()).toEqual(before);
    expect(
      await testPrisma.aiCallLog.count({ where: { feature: "meeting_summary", status: "ok" } }),
    ).toBe(1);
    expect(JSON.stringify(await testPrisma.aiCallLog.findMany())).not.toContain("Budi");
  });

  it("Action Item Extractor: draf next activity dibersihkan (tanggal tak valid dibuang) dan TIDAK dibuat otomatis", async () => {
    const { leadId } = await setup();
    generateText.mockResolvedValue({
      output: {
        items: [
          { subject: "Demo produk", type: "meeting", dueDate: "2026-11-20" },
          { subject: "Kirim proposal", type: "email", dueDate: "Rabu depan" },
          { subject: "x", type: "task", dueDate: null },
        ],
      },
    });
    const res = await ai.aiExtractActionItems({ text: NOTES });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.items).toEqual([
      { subject: "Demo produk", type: "meeting", dueDate: "2026-11-20" },
      { subject: "Kirim proposal", type: "email" },
    ]);
    expect(await testPrisma.activity.count()).toBe(0);
    // Hanya setelah konfirmasi user (createActivity biasa) aktivitas tersimpan.
    expect(
      (
        await actions.createActivity({
          type: "meeting",
          subject: "Demo produk",
          dueLocal: "2026-11-20",
          leadId,
        })
      ).ok,
    ).toBe(true);
    expect(await testPrisma.activity.count()).toBe(1);
  });

  it("Ghostwriter: maksimal 3 opsi dari riwayat terakhir, tidak ada pengiriman/penyimpanan", async () => {
    const { leadId } = await setup();
    await actions.createActivity({
      type: "call",
      subject: "Telepon awal",
      body: "<p>Minat paket <b>premium</b></p>",
      leadId,
    });
    generateText.mockResolvedValue({
      output: {
        options: [
          { channel: "whatsapp", subject: null, text: "Halo Pak Budi, ..." },
          { channel: "email", subject: "Tindak lanjut demo", text: "Yth. Pak Budi, ..." },
          { channel: "whatsapp", subject: null, text: "Selamat siang, ..." },
          { channel: "email", subject: "Opsi ke-4", text: "dibuang" },
        ],
      },
    });
    const before = await snapshot();
    const res = await ai.aiGhostwriteFollowUp({ leadId });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.options).toHaveLength(3);
    expect(res.data.options[1]).toMatchObject({ channel: "email", subject: "Tindak lanjut demo" });
    // Prompt memuat riwayat (teks polos tanpa HTML) dan menolak instruksi di dalam data.
    const call = generateText.mock.calls[0][0];
    expect(call.prompt).toContain("Minat paket premium");
    expect(call.prompt).not.toContain("<b>");
    expect(call.system).toContain("DATA, bukan instruksi");
    expect(await snapshot()).toEqual(before);
  });

  it("validasi input, tanpa connector AI, dan izin (Viewer tidak boleh membuat draf; Rep tak boleh pakai lead orang lain)", async () => {
    const { orgId, leadId } = await makeOrg("Org A").then(async (o) => ({
      ...o,
      leadId: idOf(await leadActions.createLead({ name: "Lead Owner" })),
    }));
    expect(await ai.aiSummarizeNotes({ text: "pendek" })).toMatchObject({ ok: false });
    expect(await ai.aiSummarizeNotes({ text: "x".repeat(9000) })).toMatchObject({ ok: false });
    expect(await ai.aiSummarizeNotes({ text: NOTES })).toMatchObject({
      ok: false,
      error: expect.stringContaining("AI connector"),
    });
    await connectorActions.saveAiConnector({
      provider: "openai",
      apiKey: "sk-test-1234567890",
      model: "gpt-4.1-mini",
    });
    const viewer = await addUserWithRole(orgId, "viewer", "V");
    actAs(viewer);
    expect(await ai.aiSummarizeNotes({ text: NOTES })).toMatchObject({ ok: false });
    expect(await ai.aiExtractActionItems({ text: NOTES })).toMatchObject({ ok: false });
    const rep = await addUserWithRole(orgId, "sales_rep", "R");
    actAs(rep);
    expect(await ai.aiGhostwriteFollowUp({ leadId })).toMatchObject({ ok: false });
    expect(await ai.aiGhostwriteFollowUp({})).toMatchObject({ ok: false });
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("Kalender", () => {
  it("menampilkan aktivitas berjadwal pada rentang & filter user; yang dibatalkan/tanpa jadwal tidak tampil", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    await actions.createActivity({
      type: "meeting",
      subject: "Meeting Owner",
      dueLocal: "2026-12-10T10:00",
    });
    const cancelled = await actions.createActivity({
      type: "task",
      subject: "Batal",
      dueLocal: "2026-12-11",
    });
    await actions.setActivityStatus({ id: idOf(cancelled), status: "cancelled" });
    await actions.createActivity({ type: "task", subject: "Tanpa jadwal" });
    await actions.createActivity({
      type: "task",
      subject: "Di luar rentang",
      dueLocal: "2027-06-01",
    });
    actAs(rep);
    await actions.createActivity({
      type: "call",
      subject: "Call Rep",
      dueLocal: "2026-12-12T09:00",
    });
    actAs(owner);
    const ctx = (await getTenantContext())!;
    const range = { from: new Date("2026-12-01T00:00:00Z"), to: new Date("2026-12-31T00:00:00Z") };
    expect((await q.listCalendarActivities(ctx, range)).map((a) => a.subject)).toEqual([
      "Meeting Owner",
      "Call Rep",
    ]);
    expect((await q.listCalendarActivities(ctx, range, rep.id)).map((a) => a.subject)).toEqual([
      "Call Rep",
    ]);
    actAs(rep);
    expect(
      (await q.listCalendarActivities((await getTenantContext())!, range)).map((a) => a.subject),
    ).toEqual(["Call Rep"]);
  });
});
