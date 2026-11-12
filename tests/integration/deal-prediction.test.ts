import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { snapshotDb } from "../helpers/snapshot";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { getDealPrediction, getPipelineBacktest } =
  await import("@/modules/intelligence/server/deal-prediction");
const dealA = await import("@/modules/deals/server/actions");
const contactA = await import("@/modules/contacts/server/actions");
const { ensureDefaultPipeline } = await import("@/modules/deals/server/pipeline");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

async function openDeal(title: string, extra: Record<string, unknown> = {}) {
  const contactId = idOf(await contactA.createContact({ name: `Kontak ${title}` }));
  return idOf(await dealA.createDeal({ title, contactId, ...extra }));
}

/** Isi riwayat deal tertutup: `won` deal Won & `lost` Lost, tersebar di 4 bulan, semua pernah mencapai stage ke-2. */
async function seedHistory(orgId: string, won: number, lost: number) {
  await ensureDefaultPipeline((await ctxNow()).db);
  const pipeline = await testPrisma.pipeline.findFirstOrThrow({
    where: { organizationId: orgId },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  const [s1, s2] = pipeline.stages;
  const total = won + lost;
  for (let i = 0; i < total; i++) {
    const isWon = i < won;
    const d = await testPrisma.deal.create({
      data: {
        organizationId: orgId,
        title: `Hist ${i}`,
        pipelineId: pipeline.id,
        stageId: s2!.id,
        status: isWon ? "won" : "lost",
        closedAt: new Date(Date.UTC(2026, 6 + (i % 4), 10)),
      },
    });
    await testPrisma.dealStageHistory.create({
      data: { organizationId: orgId, dealId: d.id, fromStageId: s1!.id, toStageId: s2!.id },
    });
  }
  return pipeline;
}

describe("Predictive sales assistant (plan 3.2)", () => {
  it("data minim → belum siap (tanpa angka palsu)", async () => {
    await makeOrg("Org A");
    const id = await openDeal("Deal Baru");
    const r = await getDealPrediction(await ctxNow(), id);
    expect(r).toMatchObject({ ready: false });
    expect((r as { reasons: string[] }).reasons.length).toBeGreaterThan(0);
  });

  it("data memadai → probabilitas + saran + backtest, TANPA mengubah satu pun data (Red Zone)", async () => {
    const o = await makeOrg("Org A");
    await seedHistory(o.orgId, 6, 4);
    const id = await openDeal("Deal Terbuka", { value: "1000" });
    const before = await snapshotDb([]);
    const ctx = await ctxNow();
    const r = await getDealPrediction(ctx, id);
    expect(r).toMatchObject({ ready: true });
    const ok = r as Extract<NonNullable<typeof r>, { ready: true }>;
    expect(ok.prediction.probability).toBeGreaterThan(0);
    expect(ok.prediction.factors.length).toBeGreaterThan(0);
    expect(ok.backtest!.closedDeals).toBe(10);
    expect(ok.backtest!.accuracy).toBeGreaterThanOrEqual(0);
    const pipeline = await testPrisma.pipeline.findFirstOrThrow({
      where: { organizationId: o.orgId },
    });
    expect((await getPipelineBacktest(ctx, pipeline.id))!.points).toBeGreaterThan(0);
    // stage & probabilitas deal tidak berubah; seluruh tabel utuh
    expect(await snapshotDb([])).toEqual(before);
    const deal = await testPrisma.deal.findUniqueOrThrow({ where: { id } });
    expect(deal.probability).toBeNull();
  });

  it("deal tertutup → null; rep tidak dapat memprediksi deal orang lain; lintas tenant ditolak", async () => {
    const o = await makeOrg("Org A");
    await seedHistory(o.orgId, 6, 4);
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const mine = await testPrisma.deal.findFirstOrThrow({ where: { organizationId: o.orgId } });
    const pipeline = await testPrisma.pipeline.findFirstOrThrow({
      where: { organizationId: o.orgId },
      include: { stages: { orderBy: { position: "asc" } } },
    });
    const open = await testPrisma.deal.create({
      data: {
        organizationId: o.orgId,
        title: "Milik Owner",
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0]!.id,
      },
    });
    expect(await getDealPrediction(await ctxNow(), mine.id)).toBeNull(); // sudah tertutup
    actAs(rep);
    await expect(getDealPrediction(await ctxNow(), open.id)).rejects.toThrow();
    await makeOrg("Org B");
    await expect(getDealPrediction(await ctxNow(), open.id)).rejects.toThrow();
  });
});
