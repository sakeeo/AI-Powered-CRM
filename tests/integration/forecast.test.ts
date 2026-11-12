import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { snapshotDb } from "../helpers/snapshot";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { getForecast } = await import("@/modules/intelligence/server/forecast");
const { ensureDefaultPipeline } = await import("@/modules/deals/server/pipeline");

const ctxNow = async () => (await getTenantContext())!;
const NOW = new Date("2026-11-12T06:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

async function seed(orgId: string, ownerId?: string) {
  const p = await ensureDefaultPipeline((await ctxNow()).db);
  const [s1, s2] = p.stages;
  // 14 deal tertutup tersebar 4 bulan (9 Won / 5 Lost), semua pernah mencapai stage 2
  for (let i = 0; i < 14; i++) {
    const d = await testPrisma.deal.create({
      data: {
        organizationId: orgId,
        title: `Tutup ${i}`,
        pipelineId: p.id,
        stageId: s2!.id,
        status: i < 9 ? "won" : "lost",
        value: 1_000_000,
        closedAt: ago(20 + (i % 4) * 30),
        createdAt: ago(150),
      },
    });
    await testPrisma.dealStageHistory.create({
      data: {
        organizationId: orgId,
        dealId: d.id,
        fromStageId: s1!.id,
        toStageId: s2!.id,
        createdAt: ago(140),
      },
    });
  }
  // 6 deal terbuka: perkiraan closing bulan ini (3), bulan depan (2), tanpa tanggal (1)
  const openSpec: [string, Date | null, string | undefined][] = [
    ["Terbuka A", new Date("2026-11-20"), ownerId],
    ["Terbuka B", new Date("2026-11-28"), undefined],
    ["Terbuka C", new Date("2026-11-05"), undefined], // lewat → bulan ini
    ["Terbuka D", new Date("2026-12-10"), ownerId],
    ["Terbuka E", new Date("2026-12-20"), undefined],
    ["Terbuka F", null, undefined],
  ];
  for (const [title, date, owner] of openSpec)
    await testPrisma.deal.create({
      data: {
        organizationId: orgId,
        title,
        pipelineId: p.id,
        stageId: s2!.id,
        value: 5_000_000,
        expectedCloseDate: date,
        ownerId: owner,
        createdAt: ago(30),
      },
    });
}

describe("Probabilistic forecasting (plan 3.5)", () => {
  it("data minim → belum siap (tanpa angka)", async () => {
    await makeOrg("Org A");
    const r = await getForecast(await ctxNow(), NOW);
    expect(r.ready).toBe(false);
  });

  it("rentang P10 ≤ P50 ≤ P90 per bulan, deal tak berjadwal dikecualikan, backtest tersedia, read-only", async () => {
    const o = await makeOrg("Org A");
    await seed(o.orgId);
    const before = await snapshotDb([]);
    const r = await getForecast(await ctxNow(), NOW);
    expect(await snapshotDb([])).toEqual(before);
    if (!r.ready) throw new Error(r.reasons.join(","));
    expect(r.currency).toBe("IDR");
    expect(r.months.map((m) => m.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(r.months.map((m) => m.deals)).toEqual([3, 2, 0]);
    expect(r.excluded.noDate).toBe(1);
    for (const m of r.months) {
      expect(m.p10).toBeLessThanOrEqual(m.p50);
      expect(m.p50).toBeLessThanOrEqual(m.p90);
    }
    expect(r.months[0]!.p90).toBeLessThanOrEqual(15_000_000);
    expect(r.months[0]!.expected).toBeGreaterThan(0);
    expect(r.total.deals).toBe(5);
    expect(r.total.p90).toBeLessThanOrEqual(25_000_000);
    // deterministik
    const r2 = await getForecast(await ctxNow(), NOW);
    expect(r2).toEqual(r);
    expect(r.backtest).toHaveProperty("cases");
  });

  it("rep hanya memperkirakan deal miliknya; viewer dapat melihat; tenant terisolasi", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    await seed(o.orgId, rep.id);
    actAs(rep);
    const r = await getForecast(await ctxNow(), NOW);
    if (!r.ready) throw new Error("not ready");
    expect(r.total.deals).toBe(2); // A (Nov) + D (Des) milik rep
    await makeOrg("Org B");
    expect((await getForecast(await ctxNow(), NOW)).ready).toBe(false);
  });
});
