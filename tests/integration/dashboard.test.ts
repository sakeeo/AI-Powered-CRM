import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { getDashboard, periodRange } = await import("@/modules/dashboard/server/metrics");
const leadActions = await import("@/modules/leads/server/actions");
const dealActions = await import("@/modules/deals/server/actions");
const contactActions = await import("@/modules/contacts/server/actions");
const activityActions = await import("@/modules/activities/server/actions");
const quotationActions = await import("@/modules/quotations/server/actions");
const orgActions = await import("@/modules/organizations/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

/** Data deterministik ("seed"): angka dashboard harus persis sama dengan yang dibuat di sini. */
async function seed() {
  const org = await makeOrg("Org Dash");
  const web = await testPrisma.leadSource.findFirst({ where: { organizationId: org.orgId } });
  void web;
  const { listLeadSources } = await import("@/modules/leads/server/queries");
  const sources = await listLeadSources(await ctxNow());
  const website = sources.find((s) => s.name === "Website")!.id;
  const referral = sources.find((s) => s.name === "Referral")!.id;

  const l1 = idOf(
    await leadActions.createLead({ name: "Lead Satu", sourceId: website, ownerId: org.owner.id }),
  );
  const l2 = idOf(
    await leadActions.createLead({ name: "Lead Dua", sourceId: website, ownerId: org.owner.id }),
  );
  idOf(
    await leadActions.createLead({ name: "Lead Tiga", sourceId: referral, ownerId: org.owner.id }),
  );
  await leadActions
    .createLead({ name: "Lead Arsip", sourceId: referral, ownerId: org.owner.id })
    .then((r) => leadActions.archiveLead({ id: idOf(r) }));
  // lead lama (> 24 jam) tanpa aktivitas → Action Required; satu punya aktivitas
  await testPrisma.lead.updateMany({
    where: { name: { in: ["Lead Satu", "Lead Dua", "Lead Tiga"] } },
    data: { createdAt: new Date(Date.now() - 3 * 86_400_000) },
  });
  await activityActions.createActivity({ type: "note", subject: "Sudah dihubungi", leadId: l2 });
  // konversi Lead Satu
  await leadActions.setLeadStatus({ id: l1, status: "qualified" });
  const conv = await leadActions.convertLead({
    leadId: l1,
    contact: { mode: "create" },
    company: { mode: "none" },
    deal: { create: true, title: "Deal Konversi", value: "1000", currency: "IDR" },
  });
  if (!conv.ok) throw new Error(conv.error);

  const contactId = idOf(await contactActions.createContact({ name: "Pembeli" }));
  const won1 = idOf(
    await dealActions.createDeal({ title: "Won IDR", contactId, value: "5000000" }),
  );
  const won2 = idOf(
    await dealActions.createDeal({ title: "Won USD", contactId, value: "100", currency: "USD" }),
  );
  await dealActions.markDealWon({ id: won1 });
  await dealActions.markDealWon({ id: won2 });
  await dealActions.createDeal({ title: "Open A", contactId, value: "2000000" });
  const lostId = idOf(await dealActions.createDeal({ title: "Lost", contactId, value: "999" }));
  await dealActions.markDealLost({ id: lostId, reason: "Harga terlalu tinggi" });

  // aktivitas: 1 terlambat, 1 mendatang pada deal Open A
  const openA = (await testPrisma.deal.findFirstOrThrow({ where: { title: "Open A" } })).id;
  await activityActions.createActivity({
    type: "task",
    subject: "Telat",
    dueLocal: "2020-01-01",
    dealId: openA,
  });
  await activityActions.createActivity({
    type: "task",
    subject: "Nanti",
    dueLocal: "2099-01-01T10:00",
    dealId: openA,
  });
  // quotation sent mendekati expiry
  const q = idOf(await quotationActions.createQuotation({ title: "Q dekat expiry" }));
  const soon = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await quotationActions.saveQuotation({
    id: q,
    title: "Q dekat expiry",
    validUntil: soon,
    currency: "IDR",
    globalDiscountPercent: "0",
    items: [{ name: "Jasa", quantity: "1", unitPrice: "100", discountPercent: "0" }],
  });
  await quotationActions.setQuotationStatus({ id: q, status: "sent" });
  return { ...org, website, referral };
}

describe("Dashboard — angka cocok dengan data seed", () => {
  it("KPI, pipeline, Action Required, performa source & sales sesuai definisi docs/metrics.md", async () => {
    const { owner } = await seed();
    const d = await getDashboard(await ctxNow(), { period: "30d" });

    expect(d.kpi.totalLeads).toBe(3); // Satu, Dua, Tiga (Arsip tidak dihitung)
    expect(d.kpi.newLeads).toBe(3);
    expect(d.kpi.activeDeals).toBe(2); // Deal Konversi + Open A (Won/Lost tidak)
    expect(d.kpi.openValue).toEqual({ IDR: "2001000.00" });
    expect(d.kpi.wonValue).toEqual({ IDR: "5000000.00", USD: "100.00" });
    expect(d.kpi.customers).toBe(1); // hanya "Pembeli" punya deal Won

    expect(d.pipeline.reduce((n, s) => n + s.count, 0)).toBe(2);
    expect(d.leadSeries.reduce((n, p) => n + p.leads, 0)).toBe(3);

    // Action Required
    expect(d.actionRequired.uncontactedLeads.count).toBe(1); // Lead Tiga (new, lama, tanpa aktivitas); Dua punya aktivitas; Satu sudah qualified
    expect(d.actionRequired.uncontactedLeads.items.map((l) => l.name)).toEqual(["Lead Tiga"]);
    expect(d.actionRequired.overdueFollowUps.count).toBe(1);
    expect(d.actionRequired.dealsWithoutNextActivity.count).toBe(1); // Deal Konversi; Open A punya aktivitas terbuka
    expect(d.actionRequired.dealsWithoutNextActivity.items[0]).toMatchObject({
      title: "Deal Konversi",
    });
    expect(d.actionRequired.quotationsToFollowUp.count).toBe(1);
    expect(d.activities.overdue.map((a) => a.subject)).toEqual(["Telat"]);
    expect(d.activities.upcoming.map((a) => a.subject)).toEqual(["Nanti"]);

    // Performa lead source (cohort): Website 2 lead, 1 terkonversi → 50%; Referral 1 lead (arsip tidak masuk), 0%
    const web = d.sourcePerf.find((s) => s.name === "Website")!;
    expect(web).toMatchObject({ leads: 2, converted: 1, conversionRate: 50 });
    expect(d.sourcePerf.find((s) => s.name === "Referral")).toMatchObject({
      leads: 1,
      converted: 0,
      conversionRate: 0,
    });

    // Performa sales: semua milik owner
    const mine = d.salesPerf.find((p) => p.ownerId === owner.id)!;
    expect(mine).toMatchObject({
      wonCount: 2,
      wonValue: { IDR: "5000000.00", USD: "100.00" },
      openDeals: 2,
      newLeads: 3,
    });
  });

  it("filter pengguna & tim menyempit; periode memengaruhi lead baru & tren", async () => {
    const { orgId, owner } = await seed();
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    actAs(rep);
    await leadActions.createLead({ name: "Lead Rep" });
    actAs(owner);
    const ctx = await ctxNow();
    expect((await getDashboard(ctx, { owner: rep.id })).kpi.totalLeads).toBe(1);
    expect((await getDashboard(ctx, { owner: owner.id })).kpi.totalLeads).toBe(3);
    // tim berisi rep saja
    const team = await testPrisma.team.create({ data: { organizationId: orgId, name: "Tim Rep" } });
    await testPrisma.teamMember.create({
      data: { organizationId: orgId, teamId: team.id, userId: rep.id },
    });
    expect((await getDashboard(ctx, { team: team.id })).kpi.totalLeads).toBe(1);
    expect((await getDashboard(ctx, { team: team.id, owner: owner.id })).kpi.totalLeads).toBe(0);
    // periode 7 hari: lead lama (3 hari) masih masuk; geser ke 1970 → tidak ada; pembanding
    const d7 = await getDashboard(ctx, { period: "7d" });
    expect(d7.kpi.newLeads).toBe(4);
    const future = await getDashboard(
      ctx,
      { period: "7d" },
      new Date(Date.now() + 30 * 86_400_000),
    );
    expect(future.kpi.newLeads).toBe(0);
    expect(future.kpi.newLeadsPrev).toBe(0);
    const p = periodRange("30d", "Asia/Jakarta", new Date("2026-11-11T05:00:00Z"));
    expect(p.end.getTime() - p.start.getTime()).toBe(30 * 86_400_000);
    expect(p.prevEnd.getTime()).toBe(p.start.getTime());
    expect(
      periodRange("mtd", "Asia/Jakarta", new Date("2026-11-11T05:00:00Z")).start.toISOString(),
    ).toBe("2026-10-31T17:00:00.000Z");
  });

  it("menghormati permission: Sales Rep hanya melihat angkanya sendiri; tenant lain terpisah", async () => {
    const { orgId } = await seed();
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    actAs(rep);
    const own = idOf(await leadActions.createLead({ name: "Lead Milik Rep" }));
    await activityActions.createActivity({
      type: "task",
      subject: "Tugas Rep",
      dueLocal: "2020-01-01",
      leadId: own,
    });
    const d = await getDashboard(await ctxNow());
    expect(d.kpi.totalLeads).toBe(1);
    expect(d.kpi.activeDeals).toBe(0);
    expect(d.kpi.customers).toBe(0);
    expect(d.kpi.openValue).toEqual({});
    expect(d.actionRequired.overdueFollowUps.count).toBe(1);
    expect(d.actionRequired.quotationsToFollowUp.count).toBe(0);
    expect(d.salesPerf.every((p) => p.ownerId === rep.id)).toBe(true);
    await makeOrg("Org Lain");
    const other = await getDashboard(await ctxNow());
    expect(other.kpi).toMatchObject({ totalLeads: 0, activeDeals: 0, customers: 0, newLeads: 0 });
    expect(other.sourcePerf).toEqual([]);
    void orgActions;
  });
});
