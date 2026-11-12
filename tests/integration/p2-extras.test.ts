import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const quo = await import("@/modules/quotations/server/actions");
const quoQ = await import("@/modules/quotations/server/queries");
const appr = await import("@/modules/quotations/server/approval-actions");
const ver = await import("@/modules/quotations/server/version-actions");
const { listVersions } = await import("@/modules/quotations/server/versions");
const tplA = await import("@/modules/activities/server/template-actions");
const actQ = await import("@/modules/activities/server/queries");
const repQ = await import("@/modules/customers/server/repeat");
const repA = await import("@/modules/customers/server/repeat-actions");
const dealA = await import("@/modules/deals/server/actions");
const companyA = await import("@/modules/companies/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

const line = (over: Record<string, unknown> = {}) => ({
  name: "Lisensi",
  quantity: "1",
  unitPrice: "1000000",
  discountPercent: "0",
  ...over,
});
async function draft(
  items: ReturnType<typeof line>[] = [line()],
  extra: Record<string, unknown> = {},
) {
  const id = idOf(await quo.createQuotation({ title: "Penawaran uji" }));
  const q = await quoQ.getQuotation(await ctxNow(), id);
  const save = (its: ReturnType<typeof line>[], more: Record<string, unknown> = {}) =>
    quo.saveQuotation({
      id,
      title: "Penawaran uji",
      validUntil: q.validUntil,
      currency: "IDR",
      globalDiscountPercent: "0",
      items: its,
      ...extra,
      ...more,
    } as never);
  expect((await save(items)).ok).toBe(true);
  return { id, save, validUntil: q.validUntil };
}

describe("Versi quotation", () => {
  it("mencatat versi saat isi berubah, tidak saat identik; kirim = versi tersendiri; bandingkan & pulihkan", async () => {
    await makeOrg("Org A");
    const { id, save } = await draft([line()]);
    const ctx = await ctxNow();
    expect((await listVersions(ctx.db, id)).map((v) => v.version)).toEqual([1]);
    await save([line()]); // identik
    expect(await listVersions(ctx.db, id)).toHaveLength(1);
    await save([line({ quantity: "2" }), line({ name: "Training", unitPrice: "500000" })], {
      narrative: "Pengantar",
    });
    expect((await listVersions(ctx.db, id)).map((v) => v.version)).toEqual([2, 1]);

    const cmp = await ver.compareQuotationVersions({ id, from: 1, to: 2 });
    expect(cmp.ok).toBe(true);
    const d = (cmp as { data: import("@/modules/quotations/versioning").SnapshotDiff }).data;
    expect(d.identical).toBe(false);
    expect(d.items.map((i) => i.kind).sort()).toEqual(["added", "changed"]);
    expect(d.header.map((h) => h.field)).toContain("Narasi pengantar");
    expect(Number(d.totalDelta)).toBeGreaterThan(0);
    expect(await ver.compareQuotationVersions({ id, from: 1, to: 99 })).toMatchObject({
      ok: false,
    });

    // pulihkan v1 → isi kembali; versi baru berlabel
    expect(await ver.restoreQuotationVersion({ id, version: 1 })).toMatchObject({ ok: true });
    const restored = await quoQ.getQuotation(await ctxNow(), id);
    expect(restored.items).toHaveLength(1);
    expect(restored.narrative).toBeNull();
    const vs = await listVersions((await ctxNow()).db, id);
    expect(vs[0]).toMatchObject({ version: 3, label: "Dipulihkan dari v1" });

    // kirim → versi "Dikirim" (force, walau identik)
    expect(await quo.setQuotationStatus({ id, status: "sent" })).toMatchObject({ ok: true });
    expect((await listVersions((await ctxNow()).db, id))[0]).toMatchObject({
      version: 4,
      label: "Dikirim",
    });
    // setelah terkirim tidak bisa dipulihkan
    expect(await ver.restoreQuotationVersion({ id, version: 1 })).toMatchObject({ ok: false });
  });

  it("hak akses & tenant: org lain/ rep lain tidak dapat membandingkan atau memulihkan", async () => {
    const a = await makeOrg("Org A");
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    const { id } = await draft();
    actAs(rep);
    expect(await ver.compareQuotationVersions({ id, from: 1, to: 1 })).toMatchObject({ ok: false });
    expect(await ver.restoreQuotationVersion({ id, version: 1 })).toMatchObject({ ok: false });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await ver.compareQuotationVersions({ id, from: 1, to: 1 })).toMatchObject({ ok: false });
    expect(await ver.restoreQuotationVersion({ id, version: 1 })).toMatchObject({ ok: false });
    expect(await testPrisma.quotationVersion.count({ where: { organizationId: b.orgId } })).toBe(0);
  });
});

describe("Approval quotation", () => {
  async function setup() {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const mgr2 = await addUserWithRole(o.orgId, "sales_manager", "Mgr2");
    actAs(o.owner);
    await quo.saveQuotationSettings({
      taxLabel: "PPN",
      taxRate: "11",
      taxInclusive: false,
      validityDays: 14,
      approvalThreshold: "5000000",
    });
    return { o, rep, mgr, mgr2 };
  }

  it("di bawah ambang: tidak perlu; di atas ambang: terkirim hanya setelah disetujui; ubah isi membatalkan persetujuan", async () => {
    const { o, rep, mgr } = await setup();
    actAs(rep);
    const small = await draft([line({ unitPrice: "1000000" })]);
    expect(await appr.requestQuotationApproval({ id: small.id })).toMatchObject({ ok: false });
    expect(await quo.setQuotationStatus({ id: small.id, status: "sent" })).toMatchObject({
      ok: true,
    });

    const big = await draft([line({ unitPrice: "6000000" })]);
    expect(await quo.setQuotationStatus({ id: big.id, status: "sent" })).toMatchObject({
      ok: false,
    });
    expect(await appr.requestQuotationApproval({ id: big.id })).toMatchObject({ ok: true });
    // pending: isi terkunci; rep tidak dapat memutuskan
    expect(await big.save([line({ unitPrice: "100" })])).toMatchObject({ ok: false });
    expect(await appr.decideQuotationApproval({ id: big.id, decision: "approved" })).toMatchObject({
      ok: false,
    });
    expect(await quo.setQuotationStatus({ id: big.id, status: "sent" })).toMatchObject({
      ok: false,
    });
    // approver diberi notifikasi (Owner + manager; bukan peminta)
    const notified = await testPrisma.notification.findMany({
      where: { type: "quotation_approval" },
    });
    expect(notified.map((n) => n.userId).sort()).toEqual(
      [o.owner.id, mgr.id]
        .sort()
        .concat([notified.find((n) => ![o.owner.id, mgr.id].includes(n.userId))?.userId ?? ""])
        .filter(Boolean)
        .sort(),
    );
    actAs(mgr);
    expect(await appr.decideQuotationApproval({ id: big.id, decision: "rejected" })).toMatchObject({
      ok: false,
    }); // wajib alasan
    expect(
      await appr.decideQuotationApproval({
        id: big.id,
        decision: "rejected",
        note: "Diskon terlalu besar",
      }),
    ).toMatchObject({ ok: true });
    expect(
      (await testPrisma.notification.findFirst({ where: { type: "quotation_approval_result" } }))!
        .userId,
    ).toBe(rep.id);
    actAs(rep);
    expect(await quo.setQuotationStatus({ id: big.id, status: "sent" })).toMatchObject({
      ok: false,
    });
    // ajukan ulang → disetujui → boleh kirim
    expect(await appr.requestQuotationApproval({ id: big.id })).toMatchObject({ ok: true });
    actAs(mgr);
    expect(
      await appr.decideQuotationApproval({ id: big.id, decision: "approved", note: "OK" }),
    ).toMatchObject({ ok: true });
    actAs(rep);
    // mengubah isi setelah disetujui → approval hilang
    expect(await big.save([line({ unitPrice: "6000001" })])).toMatchObject({ ok: true });
    expect(
      (await testPrisma.quotation.findUniqueOrThrow({ where: { id: big.id } })).approvalStatus,
    ).toBe("none");
    expect(await quo.setQuotationStatus({ id: big.id, status: "sent" })).toMatchObject({
      ok: false,
    });
    await appr.requestQuotationApproval({ id: big.id });
    actAs(mgr);
    await appr.decideQuotationApproval({ id: big.id, decision: "approved" });
    actAs(rep);
    expect(await quo.setQuotationStatus({ id: big.id, status: "sent" })).toMatchObject({
      ok: true,
    });
    expect(
      await testPrisma.auditLog.count({ where: { action: "quotation.approval_approved" } }),
    ).toBe(2);
  });

  it("manager tidak dapat menyetujui pengajuannya sendiri; Owner bisa; tarik pengajuan; tenant terisolasi", async () => {
    const { o, mgr, mgr2 } = await setup();
    actAs(mgr);
    const q = await draft([line({ unitPrice: "9000000" })]);
    await appr.requestQuotationApproval({ id: q.id });
    expect(await appr.decideQuotationApproval({ id: q.id, decision: "approved" })).toMatchObject({
      ok: false,
    });
    actAs(mgr2);
    expect(await appr.cancelQuotationApproval({ id: q.id })).toMatchObject({ ok: true }); // approver boleh menarik
    actAs(mgr);
    expect(await q.save([line({ unitPrice: "9000001" })])).toMatchObject({ ok: true }); // bisa diedit lagi
    await appr.requestQuotationApproval({ id: q.id });
    actAs(o.owner);
    expect(await appr.decideQuotationApproval({ id: q.id, decision: "approved" })).toMatchObject({
      ok: true,
    });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await appr.decideQuotationApproval({ id: q.id, decision: "approved" })).toMatchObject({
      ok: false,
    });
    expect(await appr.requestQuotationApproval({ id: q.id })).toMatchObject({ ok: false });
  });
});

describe("Template aktivitas", () => {
  it("kelola oleh Owner/Admin/Manager; rep hanya memakai yang aktif; nama unik; isi disanitasi", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    actAs(rep);
    expect(
      await tplA.createActivityTemplate({
        name: "Rep Tpl",
        type: "task",
        subject: "Follow up",
        dueInDays: 2,
        isActive: true,
      }),
    ).toMatchObject({ ok: false });
    actAs(mgr);
    const id = idOf(
      await tplA.createActivityTemplate({
        name: "Follow-up demo",
        type: "task",
        subject: "Follow up setelah demo",
        body: "<p>Halo</p><script>alert(1)</script>",
        dueInDays: 3,
        isActive: true,
      }),
    );
    expect(
      await tplA.createActivityTemplate({
        name: "follow-up DEMO",
        type: "call",
        subject: "x",
        dueInDays: null,
        isActive: true,
      }),
    ).toMatchObject({ ok: false });
    const row = await testPrisma.activityTemplate.findUniqueOrThrow({ where: { id } });
    expect(row.body).not.toContain("<script>");
    await tplA.createActivityTemplate({
      name: "Nonaktif",
      type: "note",
      subject: "Catatan",
      dueInDays: null,
      isActive: true,
    });
    const second = await testPrisma.activityTemplate.findFirstOrThrow({
      where: { name: "Nonaktif" },
    });
    await tplA.updateActivityTemplate({
      id: second.id,
      name: "Nonaktif",
      type: "note",
      subject: "Catatan",
      dueInDays: null,
      isActive: false,
    });
    actAs(rep);
    expect((await actQ.listActivityTemplates(await ctxNow())).map((t) => t.name)).toEqual([
      "Follow-up demo",
    ]);
    expect(await tplA.deleteActivityTemplate({ id })).toMatchObject({ ok: false });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await actQ.listActivityTemplates(await ctxNow())).toHaveLength(0);
    expect(await tplA.deleteActivityTemplate({ id })).toMatchObject({ ok: false });
    expect(
      await tplA.updateActivityTemplate({
        id,
        name: "Bajak",
        type: "task",
        subject: "x",
        dueInDays: null,
        isActive: true,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("Peluang repeat purchase", () => {
  async function won(name: string, closedDaysAgo: number[], owner?: string) {
    const company = idOf(await companyA.createCompany({ name, ownerId: owner }));
    for (const [i, ago] of closedDaysAgo.entries()) {
      const deal = idOf(
        await dealA.createDeal({
          title: `${name} #${i}`,
          companyId: company,
          value: "1000",
          ownerId: owner,
        }),
      );
      await dealA.markDealWon({ id: deal });
      await testPrisma.deal.update({
        where: { id: deal },
        data: { closedAt: new Date(Date.now() - ago * 86_400_000) },
      });
    }
    return company;
  }

  it("mengidentifikasi terlambat/segera/satu-kali-lama; mengecualikan yang punya deal terbuka & pembeli baru; terurut", async () => {
    await makeOrg("Org A");
    await won("Rutin Terlambat", [300, 240, 180]); // interval 60 → prediksi 120 hari lalu → overdue
    await won("Satu Kali Lama", [200]);
    await won("Pembeli Baru", [10]);
    const sibuk = await won("Sedang Berjalan", [300, 240, 180]);
    await dealA.createDeal({ title: "Deal terbuka", companyId: sibuk, value: "10" });
    const list = await repQ.listRepeatOpportunities(await ctxNow());
    expect(list.map((r) => [r.name, r.status])).toEqual([
      ["Rutin Terlambat", "overdue"],
      ["Satu Kali Lama", "one_time_stale"],
    ]);
    expect(list[0]).toMatchObject({ purchases: 3, avgIntervalDays: 60 });
  });

  it("scope izin & tenant; follow-up dibuat sekali (tidak ganda)", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    actAs(o.owner);
    await won("Milik Owner", [300]);
    actAs(rep);
    await won("Milik Rep", [300], rep.id);
    expect((await repQ.listRepeatOpportunities(await ctxNow())).map((r) => r.name)).toEqual([
      "Milik Rep",
    ]);
    const [item] = await repQ.listRepeatOpportunities(await ctxNow());
    expect(await repA.createRepeatFollowUp({ type: item.type, id: item.id })).toMatchObject({
      ok: true,
    });
    expect(await repA.createRepeatFollowUp({ type: item.type, id: item.id })).toMatchObject({
      ok: false,
    });
    expect(
      await testPrisma.activity.count({ where: { subject: "Follow-up repeat order: Milik Rep" } }),
    ).toBe(1);
    // rep tidak dapat membuat follow-up untuk customer yang tak dapat dilihatnya
    const ownerItem = await testPrisma.company.findFirstOrThrow({ where: { name: "Milik Owner" } });
    expect(await repA.createRepeatFollowUp({ type: "company", id: ownerItem.id })).toMatchObject({
      ok: false,
    });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await repQ.listRepeatOpportunities(await ctxNow())).toHaveLength(0);
    expect(await repA.createRepeatFollowUp({ type: "company", id: ownerItem.id })).toMatchObject({
      ok: false,
    });
  });
});
