import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { snapshotDb } from "../helpers/snapshot";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { scoreLeads, getLeadScore } = await import("@/modules/intelligence/server/lead-scoring");
const { getDataQuality } = await import("@/modules/intelligence/server/quality");
const leadA = await import("@/modules/leads/server/actions");
const actA = await import("@/modules/activities/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Lead scoring (plan 3.1)", () => {
  it("memberi skor + faktor, dan TIDAK mengubah satu pun data (status/assignment utuh)", async () => {
    await makeOrg("Org A");
    const a = idOf(
      await leadA.createLead({
        name: "Lead Panas",
        email: "p@x.co",
        phone: "08123456789",
        companyName: "PT P",
        needs: "Butuh sistem kasir untuk cabang",
        urgency: "high",
      } as never),
    );
    const b = idOf(await leadA.createLead({ name: "Lead Dingin" }));
    await actA.createActivity({
      type: "call",
      subject: "Telepon",
      leadId: a,
      status: "done",
    } as never);
    const before = await snapshotDb([]);
    const ctx = await ctxNow();
    const rows = await ctx.db.lead.findMany();
    const scores = await scoreLeads(ctx, rows);
    await getLeadScore(ctx, a);
    await getDataQuality(ctx);
    expect(scores.get(a)!.score).toBeGreaterThan(scores.get(b)!.score);
    expect(scores.get(a)!.factors.length).toBe(8);
    expect(await snapshotDb([])).toEqual(before);
  });

  it("lead terkonversi/arsip tidak dinilai; konversi sumber historis ikut sebagai faktor", async () => {
    const o = await makeOrg("Org A");
    const src = await testPrisma.leadSource.upsert({
      where: { organizationId_name: { organizationId: o.orgId, name: "Referral" } },
      update: {},
      create: { organizationId: o.orgId, name: "Referral" },
    });
    for (let i = 0; i < 6; i++)
      await testPrisma.lead.create({
        data: {
          organizationId: o.orgId,
          name: `Hist ${i}`,
          sourceId: src.id,
          convertedAt: i < 3 ? new Date() : null,
        },
      });
    const ctx = await ctxNow();
    const rows = await ctx.db.lead.findMany();
    const scores = await scoreLeads(ctx, rows);
    expect(scores.size).toBe(3); // 3 terkonversi tak dinilai
    const f = [...scores.values()][0]!.factors.find((x) => x.key === "source")!;
    expect(f.points).toBe(18); // 50% konversi → penuh
    expect(f.note).toMatch(/50%/);
  });

  it("izin: rep hanya mendapat skor lead miliknya; lintas tenant tidak terlihat", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const mine = await testPrisma.lead.create({
      data: { organizationId: o.orgId, name: "Milik Rep", ownerId: rep.id },
    });
    const other = await testPrisma.lead.create({
      data: { organizationId: o.orgId, name: "Orang Lain" },
    });
    actAs(rep);
    const ctx = await ctxNow();
    expect(await getLeadScore(ctx, mine.id)).not.toBeNull();
    expect(await getLeadScore(ctx, other.id)).toBeNull();
    await makeOrg("Org B");
    expect(await getLeadScore(await ctxNow(), mine.id)).toBeNull();
  });

  it("kualitas data: fitur belum siap bila data minim", async () => {
    await makeOrg("Org A");
    const q = await getDataQuality(await ctxNow());
    expect(q.readiness.leadScoring.ready).toBe(false);
    expect(q.readiness.dealPrediction.ready).toBe(false);
    expect(q.readiness.forecast.reasons.length).toBeGreaterThan(0);
  });
});
