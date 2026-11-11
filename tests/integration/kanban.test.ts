import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const actions = await import("@/modules/deals/server/actions");
const q = await import("@/modules/deals/server/queries");
const contactActions = await import("@/modules/contacts/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

async function newDeal(extra: Record<string, unknown> = {}) {
  const contactId = idOf(await contactActions.createContact({ name: "Kontak K" }));
  const res = await actions.createDeal({
    title: "Deal Kanban",
    contactId,
    value: "1000000",
    currency: "IDR",
    ...extra,
  });
  if (!res.ok) throw new Error(JSON.stringify(res));
  return idOf(res);
}

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Kanban, history, Won/Lost", () => {
  it("pindah stage mencatat history (siapa, kapan, dari→ke) dan memperbarui kolom board", async () => {
    const { owner } = await makeOrg("Org A");
    const id = await newDeal();
    const p = await q.getDefaultPipeline(await ctxNow());
    const [s1, s2, s3] = p.stages;
    expect((await actions.moveDealStage({ id, stageId: s2.id })).ok).toBe(true);
    expect((await actions.moveDealStage({ id, stageId: s3.id })).ok).toBe(true);
    // pindah ke stage yang sama tidak mencatat apa pun
    await actions.moveDealStage({ id, stageId: s3.id });
    const hist = await testPrisma.dealStageHistory.findMany({
      where: { dealId: id },
      orderBy: { createdAt: "asc" },
    });
    expect(hist.map((h) => [h.fromStageId, h.toStageId])).toEqual([
      [s1.id, s2.id],
      [s2.id, s3.id],
    ]);
    expect(hist.every((h) => h.changedBy === owner.id)).toBe(true);

    const board = await q.getKanban(await ctxNow(), p.id);
    expect(board.cards.find((c) => c.id === id)?.stageId).toBe(s3.id);
    expect(board.summary.find((s) => s.stageId === s3.id)?.count).toBe(1);
  });

  it("stage dari pipeline lain / terarsip ditolak dan tidak mencatat history", async () => {
    await makeOrg("Org A");
    const id = await newDeal();
    expect(
      await actions.moveDealStage({ id, stageId: "00000000-0000-4000-8000-000000000000" }),
    ).toMatchObject({ ok: false });
    expect(await testPrisma.dealStageHistory.count()).toBe(0);
  });

  it("Lost wajib alasan; Won/Lost menutup deal; deal tertutup tak bisa dipindah; bisa dibuka kembali", async () => {
    await makeOrg("Org A");
    const id = await newDeal();
    expect(await actions.markDealLost({ id, reason: "" })).toMatchObject({ ok: false });
    expect(await actions.markDealLost({ id, reason: "ab" })).toMatchObject({ ok: false });
    expect((await actions.markDealLost({ id, reason: "Harga terlalu tinggi" })).ok).toBe(true);
    let d = await testPrisma.deal.findUniqueOrThrow({ where: { id } });
    expect(d).toMatchObject({ status: "lost", lostReason: "Harga terlalu tinggi" });
    expect(d.closedAt).not.toBeNull();
    const p = await q.getDefaultPipeline(await ctxNow());
    expect(await actions.moveDealStage({ id, stageId: p.stages[1].id })).toMatchObject({
      ok: false,
    });
    expect(await actions.markDealWon({ id })).toMatchObject({ ok: false });
    expect((await actions.reopenDeal({ id })).ok).toBe(true);
    expect((await actions.markDealWon({ id })).ok).toBe(true);
    d = await testPrisma.deal.findUniqueOrThrow({ where: { id } });
    expect(d).toMatchObject({ status: "won", lostReason: null });
    // tidak muncul di board (hanya deal terbuka)
    expect((await q.getKanban(await ctxNow(), p.id)).cards).toHaveLength(0);
    expect(
      await testPrisma.auditLog.count({
        where: { action: { in: ["deal.won", "deal.lost", "deal.reopened"] } },
      }),
    ).toBe(3);
  });

  it("filter owner & periode; badge risiko hanya informasi (stage tidak berubah)", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const overdueId = await newDeal({ expectedCloseDate: "2020-01-01" });
    actAs(rep);
    await newDeal({ title: "Milik Rep" });
    actAs(owner);
    const ctx = await ctxNow();
    const p = await q.getDefaultPipeline(ctx);
    const stageBefore = (await testPrisma.deal.findUniqueOrThrow({ where: { id: overdueId } }))
      .stageId;

    const all = await q.getKanban(ctx, p.id);
    expect(all.cards).toHaveLength(2);
    expect(all.cards.find((c) => c.id === overdueId)?.risk?.level).toBe("high");
    expect((await q.getKanban(ctx, p.id, { owner: rep.id })).cards.map((c) => c.title)).toEqual([
      "Milik Rep",
    ]);
    expect(
      (await q.getKanban(ctx, p.id, { closeTo: "2021-01-01" })).cards.map((c) => c.id),
    ).toEqual([overdueId]);
    expect((await testPrisma.deal.findUniqueOrThrow({ where: { id: overdueId } })).stageId).toBe(
      stageBefore,
    );
    expect(await testPrisma.dealStageHistory.count()).toBe(0);
  });

  it("Sales Rep hanya melihat/memindah deal miliknya; Viewer tidak boleh menggeser", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(orgId, "viewer", "Viewer");
    const ownerDeal = await newDeal({ title: "Milik Owner" });
    const p = await q.getDefaultPipeline(await ctxNow());
    actAs(rep);
    expect((await q.getKanban(await ctxNow(), p.id)).cards).toHaveLength(0);
    expect(await actions.moveDealStage({ id: ownerDeal, stageId: p.stages[1].id })).toMatchObject({
      ok: false,
    });
    actAs(viewer);
    expect(await actions.moveDealStage({ id: ownerDeal, stageId: p.stages[1].id })).toMatchObject({
      ok: false,
    });
    expect(await actions.markDealWon({ id: ownerDeal })).toMatchObject({ ok: false });
    actAs(owner);
    expect(await testPrisma.dealStageHistory.count()).toBe(0);
  });
});
