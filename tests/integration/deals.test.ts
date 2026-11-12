import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const actions = await import("@/modules/deals/server/actions");
const q = await import("@/modules/deals/server/queries");
const contactActions = await import("@/modules/contacts/server/actions");
const { DEAL_SORTS } = await import("@/modules/deals/constants");

const params = (sp = {}) => parseListParams(sp, DEAL_SORTS, "createdAt");
const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

async function newContact(name = "Kontak Deal") {
  return idOf(await contactActions.createContact({ name }));
}

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Pipeline default & konfigurasi stage", () => {
  it("organisasi baru mendapat pipeline default dengan 5 stage berprobabilitas", async () => {
    await makeOrg("Org A");
    const p = await q.getDefaultPipeline(await ctxNow());
    expect(p.isDefault).toBe(true);
    expect(p.stages.map((s) => s.name)).toEqual([
      "New Opportunity",
      "Contacted",
      "Needs Analysis",
      "Proposal / Quotation",
      "Negotiation",
    ]);
    expect(p.stages.map((s) => s.probability)).toEqual([10, 20, 40, 60, 80]);
    // Won/Lost bukan stage
    expect(p.stages.some((s) => /won|lost/i.test(s.name))).toBe(false);
  });

  it("Owner/Admin/Manager dapat menambah, mengubah, mengurutkan, dan mengarsipkan stage; rep tidak", async () => {
    const { orgId } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const mgr = await addUserWithRole(orgId, "sales_manager", "Mgr");
    expect((await actions.createStage({ name: "Demo", probability: 50 })).ok).toBe(true);
    let p = await q.getDefaultPipeline(await ctxNow());
    expect(p.stages.at(-1)?.name).toBe("Demo");

    const demo = p.stages.at(-1)!;
    expect(
      (await actions.updateStage({ id: demo.id, name: "Demo Produk", probability: 55 })).ok,
    ).toBe(true);
    expect(
      await actions.updateStage({ id: demo.id, name: "Demo", probability: 150 }),
    ).toMatchObject({ ok: false });

    await actions.reorderStage({ id: demo.id, direction: "up" });
    p = await q.getDefaultPipeline(await ctxNow());
    expect(p.stages.map((s) => s.name).slice(-2)).toEqual(["Demo Produk", "Negotiation"]);
    // pindah ke atas di paling atas tidak error
    await actions.reorderStage({ id: p.stages[0].id, direction: "up" });

    actAs(mgr);
    expect((await actions.createStage({ name: "Stage Mgr", probability: 5 })).ok).toBe(true);
    actAs(rep);
    expect(await actions.createStage({ name: "Stage Rep", probability: 5 })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    expect(await actions.archiveStage({ id: demo.id })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
  });

  it("arsip stage ditolak bila ada deal terbuka atau tinggal satu stage", async () => {
    await makeOrg("Org A");
    const p = await q.getDefaultPipeline(await ctxNow());
    const contactId = await newContact();
    const dealId = idOf(
      await actions.createDeal({ title: "Deal Stage", contactId, stageId: p.stages[2].id }),
    );
    expect(await actions.archiveStage({ id: p.stages[2].id })).toMatchObject({ ok: false });
    await actions.moveDealStage({ id: dealId, stageId: p.stages[0].id });
    expect((await actions.archiveStage({ id: p.stages[2].id })).ok).toBe(true);
    // stage terarsip tidak bisa jadi tujuan
    expect(await actions.moveDealStage({ id: dealId, stageId: p.stages[2].id })).toMatchObject({
      ok: false,
    });
    expect((await actions.deleteDeal({ id: dealId })).ok).toBe(true);
    for (const s of p.stages.filter((s) => s.id !== p.stages[2].id).slice(0, 3))
      expect((await actions.archiveStage({ id: s.id })).ok).toBe(true);
    expect(await actions.archiveStage({ id: p.stages[4].id })).toMatchObject({ ok: false }); // tinggal satu
  });
});

describe("Deal CRUD & validasi", () => {
  it("membuat deal: stage pertama default, uang Decimal tepat, tanggal & probabilitas", async () => {
    const { orgId } = await makeOrg("Org A");
    const contactId = await newContact();
    const res = await actions.createDeal({
      title: "Proyek ERP",
      contactId,
      value: "1234567.89",
      currency: "IDR",
      expectedCloseDate: "2026-12-31",
      probability: 70,
      notes: "Prioritas",
    });
    expect(res.ok).toBe(true);
    const deal = await q.getDeal(await ctxNow(), idOf(res));
    expect(deal.value).toBe("1234567.89");
    expect(deal.expectedCloseDate).toBe("2026-12-31");
    expect(deal.stage.name).toBe("New Opportunity");
    expect(deal.status).toBe("open");
    expect(deal.probability).toBe(70);
    expect(deal.organizationId).toBe(orgId);
    // mata uang & nilai nol default
    const d2 = await q.getDeal(
      await ctxNow(),
      idOf(await actions.createDeal({ title: "Tanpa Nilai", contactId })),
    );
    expect(d2.value).toBe("0.00");
  });

  it("validasi: wajib contact/company, uang, mata uang, tanggal, probabilitas, referensi tidak valid", async () => {
    await makeOrg("Org A");
    const contactId = await newContact();
    expect(await actions.createDeal({ title: "Tanpa Pihak" })).toMatchObject({ ok: false });
    expect(await actions.createDeal({ title: "Uang", contactId, value: "10.123" })).toMatchObject({
      ok: false,
    });
    expect(await actions.createDeal({ title: "Uang", contactId, value: "-1" })).toMatchObject({
      ok: false,
    });
    expect(await actions.createDeal({ title: "Uang", contactId, value: "abc" })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.createDeal({ title: "Cur", contactId, currency: "XXX" as never }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createDeal({ title: "Tgl", contactId, expectedCloseDate: "31/12/2026" }),
    ).toMatchObject({ ok: false });
    expect(await actions.createDeal({ title: "Prob", contactId, probability: 101 })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.createDeal({ title: "Ref", contactId: "00000000-0000-4000-8000-000000000000" }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createDeal({
        title: "Stage",
        contactId,
        stageId: "00000000-0000-4000-8000-000000000000",
      }),
    ).toMatchObject({ ok: false });
  });

  it("ubah, pindah stage (hanya stage pipeline sendiri), hapus lunak + audit", async () => {
    await makeOrg("Org A");
    const contactId = await newContact();
    const id = idOf(await actions.createDeal({ title: "Deal X", contactId, value: "100" }));
    expect(
      (
        await actions.updateDeal({
          id,
          title: "Deal X2",
          contactId,
          value: "250.50",
          currency: "USD",
        })
      ).ok,
    ).toBe(true);
    const d = await q.getDeal(await ctxNow(), id);
    expect(d).toMatchObject({ title: "Deal X2", value: "250.50", currency: "USD" });

    const p = await q.getDefaultPipeline(await ctxNow());
    expect((await actions.moveDealStage({ id, stageId: p.stages[3].id })).ok).toBe(true);
    expect((await q.getDeal(await ctxNow(), id)).stage.name).toBe("Proposal / Quotation");

    expect((await actions.deleteDeal({ id })).ok).toBe(true);
    await expect(q.getDeal(await ctxNow(), id)).rejects.toMatchObject({ status: 404 });
    expect(await testPrisma.auditLog.count({ where: { entityType: "Deal" } })).toBe(4);
  });

  it("list: pencarian (judul/contact/company), filter, sort nilai, pagination", async () => {
    const { owner } = await makeOrg("Org A");
    const companyId = (
      await testPrisma.company.create({
        data: { organizationId: (await ctxNow()).organizationId, name: "PT Cari" },
      })
    ).id;
    const contactId = await newContact("Budi Cari");
    for (let i = 1; i <= 22; i++) {
      await actions.createDeal({
        title: `Deal ${String(i).padStart(2, "0")}`,
        contactId: i === 5 ? undefined : contactId,
        companyId: i === 5 ? companyId : undefined,
        value: String(i * 100),
      });
    }
    const c = await ctxNow();
    const p1 = await q.listDeals(c, params({ sort: "title", dir: "asc", pageSize: "20" }));
    expect(p1.total).toBe(22);
    expect(p1.rows).toHaveLength(20);
    expect(
      (
        await q.listDeals(c, params({ sort: "title", dir: "asc", page: "2", pageSize: "20" }))
      ).rows.map((r) => r.title),
    ).toEqual(["Deal 21", "Deal 22"]);
    expect((await q.listDeals(c, params({ sort: "value", dir: "desc" }))).rows[0].title).toBe(
      "Deal 22",
    );
    expect((await q.listDeals(c, params({ q: "PT Cari" }))).rows.map((r) => r.title)).toEqual([
      "Deal 05",
    ]);
    expect((await q.listDeals(c, params({ q: "budi cari" }))).total).toBe(21);
    expect((await q.listDeals(c, params(), { owner: owner.id })).total).toBe(22);
    expect((await q.listDeals(c, params(), { owner: "unassigned" })).total).toBe(0);
    expect((await q.listDeals(c, params(), { contactId })).total).toBe(21);
    expect((await q.listRelatedDeals(c, { companyId })).map((d) => d.title)).toEqual(["Deal 05"]);
  });
});

describe("Ringkasan pipeline (nilai Decimal)", () => {
  it("jumlah & nilai tertimbang per stage per mata uang tanpa kesalahan floating point", async () => {
    await makeOrg("Org A");
    const contactId = await newContact();
    const p = await q.getDefaultPipeline(await ctxNow());
    const [s1, , s3] = p.stages;
    await actions.createDeal({ title: "Deal A", contactId, value: "0.10", stageId: s1.id });
    await actions.createDeal({ title: "Deal B", contactId, value: "0.20", stageId: s1.id });
    await actions.createDeal({
      title: "Deal C",
      contactId,
      value: "1000.00",
      currency: "USD",
      stageId: s1.id,
    });
    await actions.createDeal({
      title: "Deal D",
      contactId,
      value: "500",
      stageId: s3.id,
      probability: 50,
    });
    const sum = await q.pipelineSummary(await ctxNow(), p.id);
    const first = sum.find((s) => s.stageId === s1.id)!;
    expect(first.count).toBe(3);
    expect(first.totals).toEqual({ IDR: "0.30", USD: "1000.00" }); // 0.1 + 0.2 == 0.30 persis
    expect(first.weighted).toEqual({ IDR: "0.03", USD: "100.00" }); // probabilitas stage 10%
    const third = sum.find((s) => s.stageId === s3.id)!;
    expect(third.weighted).toEqual({ IDR: "250.00" }); // override probabilitas deal 50%
  });
});

describe("Deal — izin & isolasi tenant", () => {
  it("sales rep hanya melihat/mengubah dealnya sendiri; viewer hanya baca", async () => {
    const { orgId } = await makeOrg("Org A");
    const contactId = await newContact();
    const ownerDeal = idOf(await actions.createDeal({ title: "Milik Owner", contactId }));
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(orgId, "viewer", "Viewer");
    actAs(rep);
    const c = await ctxNow();
    expect((await q.listDeals(c, params())).total).toBe(0);
    await expect(q.getDeal(c, ownerDeal)).rejects.toMatchObject({ status: 404 });
    const mine = idOf(await actions.createDeal({ title: "Milik Rep", contactId }));
    expect((await q.listDeals(c, params())).rows.map((r) => r.title)).toEqual(["Milik Rep"]);
    expect((await actions.updateDeal({ id: mine, title: "Milik Rep 2", contactId })).ok).toBe(true);
    expect(await actions.updateDeal({ id: ownerDeal, title: "Curi", contactId })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.moveDealStage({
        id: ownerDeal,
        stageId: (await q.getDefaultPipeline(c)).stages[1].id,
      }),
    ).toMatchObject({ ok: false });
    expect(await actions.deleteDeal({ id: ownerDeal })).toMatchObject({ ok: false });
    // related deals memakai scope
    expect((await q.listRelatedDeals(c, { contactId })).map((d) => d.title)).toEqual([
      "Milik Rep 2",
    ]);

    actAs(viewer);
    expect((await q.listDeals(await ctxNow(), params())).total).toBe(2);
    expect(await actions.createDeal({ title: "Viewer Deal", contactId })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
  });

  it("tenant lain tidak bisa baca/ubah/pindah/hapus atau memakai contact & stage org lain", async () => {
    const a = await makeOrg("Org A");
    const contactA = await newContact();
    const dealA = idOf(await actions.createDeal({ title: "Rahasia A", contactId: contactA }));
    const pipeA = await q.getDefaultPipeline(await ctxNow());
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const cB = await ctxNow();
    await expect(q.getDeal(cB, dealA)).rejects.toMatchObject({ status: 404 });
    expect((await q.listDeals(cB, params())).total).toBe(0);
    expect(
      await actions.updateDeal({ id: dealA, title: "Hijack", contactId: contactA }),
    ).toMatchObject({ ok: false });
    expect(await actions.moveDealStage({ id: dealA, stageId: pipeA.stages[1].id })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteDeal({ id: dealA })).toMatchObject({ ok: false });
    expect(
      await actions.createDeal({ title: "Pakai Contact A", contactId: contactA }),
    ).toMatchObject({ ok: false });
    const contactB = await newContact("Kontak B");
    expect(
      await actions.createDeal({
        title: "Pakai Stage A",
        contactId: contactB,
        stageId: pipeA.stages[1].id,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.updateStage({ id: pipeA.stages[0].id, name: "Hijack", probability: 1 }),
    ).toMatchObject({ ok: false });
    expect(await actions.archiveStage({ id: pipeA.stages[0].id })).toMatchObject({ ok: false });
    expect(
      (await testPrisma.pipelineStage.findUniqueOrThrow({ where: { id: pipeA.stages[0].id } }))
        .name,
    ).toBe("New Opportunity");
    expect((await testPrisma.deal.findUniqueOrThrow({ where: { id: dealA } })).title).toBe(
      "Rahasia A",
    );
    expect(a.orgId).toBeTruthy();
  });
});
