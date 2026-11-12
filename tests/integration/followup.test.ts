import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { snapshotDb } from "../helpers/snapshot";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const fu = await import("@/modules/intelligence/server/followup");
const fuA = await import("@/modules/intelligence/server/followup-actions");

const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

async function leadWithHistory(orgId: string, ownerId?: string) {
  const lead = await testPrisma.lead.create({
    data: { organizationId: orgId, name: "Budi Santoso", ownerId },
  });
  // 4 interaksi selesai tiap Rabu 10:00 WIB (03:00Z) — dua lewat WhatsApp, dua telepon
  const days = ["2026-10-14", "2026-10-21", "2026-10-28", "2026-11-04"];
  for (const [i, d] of days.entries())
    await testPrisma.activity.create({
      data: {
        organizationId: orgId,
        type: i % 2 ? "whatsapp" : "call",
        subject: `Kontak ${i}`,
        status: "done",
        leadId: lead.id,
        completedAt: new Date(`${d}T03:00:00Z`),
      },
    });
  return lead;
}

describe("AI follow-up recommendation (plan 3.3)", () => {
  it("memberi rekomendasi dari pola historis & TIDAK mengubah data saat dibaca", async () => {
    const o = await makeOrg("Org A");
    const lead = await leadWithHistory(o.orgId);
    const before = await snapshotDb([]);
    const rec = await fu.getFollowUpRecommendation(await ctxNow(), { type: "lead", id: lead.id });
    expect(rec.basis).toBe("party");
    expect(rec.channel).not.toBeNull();
    expect(rec.weekday).toBe(3);
    expect(rec.draft.subject).toContain("Budi Santoso");
    expect(await snapshotDb([])).toEqual(before);
  });

  it("terima → membuat TASK terbuka (bukan pesan terkirim) + umpan balik 'accepted'; duplikat ditolak", async () => {
    const o = await makeOrg("Org A");
    const lead = await leadWithHistory(o.orgId);
    const s = { type: "lead" as const, id: lead.id };
    const r = await fuA.acceptFollowUpRecommendation(s);
    expect(r.ok).toBe(true);
    const task = await testPrisma.activity.findFirstOrThrow({
      where: { leadId: lead.id, type: "task", status: "open" },
    });
    expect(task.dueAt).not.toBeNull();
    expect(task.body).toContain("<p>");
    expect(await testPrisma.message.count()).toBe(0);
    expect(await fuA.acceptFollowUpRecommendation(s)).toMatchObject({ ok: false });
    expect(await testPrisma.recommendationFeedback.count({ where: { decision: "accepted" } })).toBe(
      1,
    );
    expect(
      await testPrisma.auditLog.count({ where: { action: "followup.recommendation_accepted" } }),
    ).toBe(1);
  });

  it("tolak mencatat umpan balik saja; metrik penerimaan dihitung", async () => {
    const o = await makeOrg("Org A");
    const lead = await leadWithHistory(o.orgId);
    const s = { type: "lead" as const, id: lead.id };
    await fuA.acceptFollowUpRecommendation(s);
    const tasks = await testPrisma.activity.count();
    await fuA.rejectFollowUpRecommendation(s);
    await fuA.rejectFollowUpRecommendation(s);
    expect(await testPrisma.activity.count()).toBe(tasks);
    const m = await fu.getAcceptanceMetrics(await ctxNow());
    expect(m).toMatchObject({ accepted: 1, rejected: 2 });
    expect(m.rate).toBeCloseTo(1 / 3);
  });

  it("izin: rep tak dapat merekomendasikan lead orang lain; viewer tak dapat menerima; lintas tenant ditolak", async () => {
    const o = await makeOrg("Org A");
    const lead = await leadWithHistory(o.orgId); // milik owner (tanpa ownerId)
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Viewer");
    const s = { type: "lead" as const, id: lead.id };
    actAs(rep);
    expect(await fuA.acceptFollowUpRecommendation(s)).toMatchObject({ ok: false });
    actAs(viewer);
    expect(await fuA.acceptFollowUpRecommendation(s)).toMatchObject({ ok: false });
    await makeOrg("Org B");
    expect(await fuA.rejectFollowUpRecommendation(s)).toMatchObject({ ok: false });
    expect(await testPrisma.recommendationFeedback.count()).toBe(0);
  });
});
