import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { dateInTz, zonedToUtc } from "@/lib/timezone";
import { listCustomers } from "@/modules/customers/server/queries";
import {
  getDefaultPipeline,
  pipelineSummary,
  type DealFilters,
} from "@/modules/deals/server/queries";
import { getOrganization } from "@/modules/organizations/server/queries";

/** Definisi lengkap tiap metrik: docs/metrics.md. Perubahan rumus WAJIB memperbarui dokumen itu. */
export const PERIODS = ["7d", "30d", "90d", "mtd"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = {
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "90d": "90 hari terakhir",
  mtd: "Bulan ini",
};
const DAY = 86_400_000;

export type DashboardFilters = { period?: string; owner?: string; team?: string };

export function periodRange(period: Period, tz: string, now: Date) {
  let start: Date;
  if (period === "mtd") start = zonedToUtc(`${dateInTz(now, tz).slice(0, 8)}01T00:00`, tz);
  else start = new Date(now.getTime() - { "7d": 7, "30d": 30, "90d": 90 }[period] * DAY);
  const length = now.getTime() - start.getTime();
  return { start, end: now, prevStart: new Date(start.getTime() - length), prevEnd: start };
}

const sumByCurrency = (rows: { currency: string; _sum: { value: Prisma.Decimal | null } }[]) => {
  const out: Record<string, string> = {};
  for (const r of rows)
    out[r.currency] = new Decimal(out[r.currency] ?? 0)
      .plus(r._sum.value?.toString() ?? 0)
      .toFixed(2);
  return out;
};

/** Periode + filter pengguna/tim → rentang waktu dan pembatas pemilik. Dipakai dashboard & laporan agar konsisten. */
export async function resolveFilters(ctx: TenantContext, filters: DashboardFilters, now: Date) {
  const org = await getOrganization(ctx);
  const period = (PERIODS as readonly string[]).includes(filters.period ?? "")
    ? (filters.period as Period)
    : "30d";
  const range = periodRange(period, org.timezone, now);
  let ownerIds: string[] | undefined;
  if (filters.team) {
    const members = await ctx.db.teamMember.findMany({
      where: { teamId: filters.team },
      select: { userId: true },
    });
    ownerIds = members.map((m) => m.userId);
  }
  if (filters.owner)
    ownerIds = ownerIds ? ownerIds.filter((id) => id === filters.owner) : [filters.owner];
  return {
    org,
    period,
    ...range,
    ownerIds,
    ownerWhere: ownerIds ? { ownerId: { in: ownerIds } } : {},
  };
}

export async function getDashboard(
  ctx: TenantContext,
  filters: DashboardFilters = {},
  now = new Date(),
) {
  const { org, period, start, end, prevStart, prevEnd, ownerIds, ownerWhere } =
    await resolveFilters(ctx, filters, now);

  const leadScope = scopeWhere(ctx, "view", "Lead") as Prisma.LeadWhereInput;
  const dealScope = scopeWhere(ctx, "view", "Deal") as Prisma.DealWhereInput;
  const actScope = scopeWhere(ctx, "view", "Activity") as Prisma.ActivityWhereInput;
  const quoScope = scopeWhere(ctx, "view", "Quotation") as Prisma.QuotationWhereInput;
  const leads = (extra: Prisma.LeadWhereInput = {}): Prisma.LeadWhereInput => ({
    AND: [{ archivedAt: null }, leadScope, ownerWhere, extra],
  });
  const deals = (extra: Prisma.DealWhereInput = {}): Prisma.DealWhereInput => ({
    AND: [{ deletedAt: null }, dealScope, ownerWhere, extra],
  });
  const acts = (extra: Prisma.ActivityWhereInput = {}): Prisma.ActivityWhereInput => ({
    AND: [actScope, ownerWhere, extra],
  });
  const dealFilters: DealFilters = ownerIds ? { ownerIds } : {};
  const pipeline = await getDefaultPipeline(ctx);
  const day = dateInTz(now, org.timezone);
  const warnUntil = new Date(`${day}T00:00:00Z`).getTime() + 3 * DAY;

  const [
    totalLeads,
    newLeads,
    prevNewLeads,
    activeDeals,
    openValue,
    wonValue,
    customers,
    stageSummary,
    overdueCount,
    overdueList,
    upcomingList,
    recent,
    uncontactedCount,
    uncontactedList,
    noNextCount,
    noNextList,
    quoCount,
    quoList,
    wonByOwner,
    openByOwner,
    leadsByOwner,
    leadsBySource,
    leadRows,
    sources,
  ] = await Promise.all([
    ctx.db.lead.count({ where: leads() }),
    ctx.db.lead.count({ where: leads({ createdAt: { gte: start, lte: end } }) }),
    ctx.db.lead.count({ where: leads({ createdAt: { gte: prevStart, lt: prevEnd } }) }),
    ctx.db.deal.count({ where: deals({ status: "open" }) }),
    ctx.db.deal.groupBy({
      by: ["currency"],
      where: deals({ status: "open" }),
      _sum: { value: true },
    }),
    ctx.db.deal.groupBy({
      by: ["currency"],
      where: deals({ status: "won", closedAt: { gte: start, lte: end } }),
      _sum: { value: true },
    }),
    listCustomers(
      ctx,
      { page: 1, pageSize: 1, skip: 0, take: 1, sort: "lastWonAt", dir: "desc", orderBy: {} },
      {},
    ).then((r) => r.total),
    pipelineSummary(ctx, pipeline.id, dealFilters),
    ctx.db.activity.count({ where: acts({ status: "open", dueAt: { lt: now } }) }),
    ctx.db.activity.findMany({
      where: acts({ status: "open", dueAt: { lt: now } }),
      orderBy: { dueAt: "asc" },
      take: 5,
      select: {
        id: true,
        subject: true,
        dueAt: true,
        leadId: true,
        dealId: true,
        contactId: true,
        companyId: true,
      },
    }),
    ctx.db.activity.findMany({
      where: acts({ status: "open", dueAt: { gte: now } }),
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, subject: true, dueAt: true, type: true },
    }),
    ctx.db.activity.findMany({
      where: acts(),
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, subject: true, type: true, status: true, createdAt: true },
    }),
    ctx.db.lead.count({
      where: leads({
        status: "new",
        createdAt: { lt: new Date(now.getTime() - DAY) },
        activities: { none: {} },
      }),
    }),
    ctx.db.lead.findMany({
      where: leads({
        status: "new",
        createdAt: { lt: new Date(now.getTime() - DAY) },
        activities: { none: {} },
      }),
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    ctx.db.deal.count({
      where: deals({ status: "open", activities: { none: { status: "open" } } }),
    }),
    ctx.db.deal.findMany({
      where: deals({ status: "open", activities: { none: { status: "open" } } }),
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, title: true },
    }),
    ctx.db.quotation.count({
      where: {
        AND: [
          { deletedAt: null },
          quoScope,
          ownerWhere,
          { status: "sent", validUntil: { lte: new Date(warnUntil) } },
        ],
      },
    }),
    ctx.db.quotation.findMany({
      where: {
        AND: [
          { deletedAt: null },
          quoScope,
          ownerWhere,
          { status: "sent", validUntil: { lte: new Date(warnUntil) } },
        ],
      },
      orderBy: { validUntil: "asc" },
      take: 5,
      select: { id: true, number: true, validUntil: true },
    }),
    ctx.db.deal.groupBy({
      by: ["ownerId", "currency"],
      where: deals({ status: "won", closedAt: { gte: start, lte: end } }),
      _sum: { value: true },
      _count: { _all: true },
    }),
    ctx.db.deal.groupBy({
      by: ["ownerId"],
      where: deals({ status: "open" }),
      _count: { _all: true },
    }),
    ctx.db.lead.groupBy({
      by: ["ownerId"],
      where: leads({ createdAt: { gte: start, lte: end } }),
      _count: { _all: true },
    }),
    ctx.db.lead.groupBy({
      by: ["sourceId"],
      where: leads({ createdAt: { gte: start, lte: end } }),
      _count: { _all: true },
    }),
    ctx.db.lead.findMany({
      where: leads({ createdAt: { gte: start, lte: end } }),
      select: { createdAt: true, convertedAt: true, sourceId: true },
      take: 10000,
    }),
    ctx.db.leadSource.findMany({ select: { id: true, name: true } }),
  ]);

  // Konversi per sumber (cohort: lead dibuat dalam periode; terkonversi = convertedAt terisi).
  const converted = new Map<string, number>();
  for (const r of leadRows)
    if (r.convertedAt) converted.set(r.sourceId ?? "", (converted.get(r.sourceId ?? "") ?? 0) + 1);
  const sourceName = new Map(sources.map((s) => [s.id, s.name]));
  const sourcePerf = leadsBySource
    .map((r) => {
      const total = r._count._all;
      const conv = converted.get(r.sourceId ?? "") ?? 0;
      return {
        sourceId: r.sourceId,
        name: r.sourceId ? (sourceName.get(r.sourceId) ?? "—") : "Tanpa sumber",
        leads: total,
        converted: conv,
        conversionRate: total ? Math.round((conv / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // Lead baru per hari (zona waktu organisasi), mengisi hari kosong dengan 0.
  const perDay = new Map<string, number>();
  for (const r of leadRows) {
    const d = dateInTz(r.createdAt, org.timezone);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const series: { date: string; leads: number }[] = [];
  for (
    let t = Date.parse(`${dateInTz(start, org.timezone)}T00:00:00Z`);
    t <= Date.parse(`${day}T00:00:00Z`);
    t += DAY
  ) {
    const d = new Date(t).toISOString().slice(0, 10);
    series.push({ date: d, leads: perDay.get(d) ?? 0 });
  }

  // Performa sales per pemilik.
  const perf = new Map<
    string,
    {
      ownerId: string | null;
      wonCount: number;
      wonValue: Record<string, string>;
      openDeals: number;
      newLeads: number;
    }
  >();
  const row = (ownerId: string | null) => {
    const k = ownerId ?? "";
    if (!perf.has(k))
      perf.set(k, { ownerId, wonCount: 0, wonValue: {}, openDeals: 0, newLeads: 0 });
    return perf.get(k)!;
  };
  for (const r of wonByOwner) {
    const p = row(r.ownerId);
    p.wonCount += r._count._all;
    p.wonValue[r.currency] = new Decimal(p.wonValue[r.currency] ?? 0)
      .plus(r._sum.value?.toString() ?? 0)
      .toFixed(2);
  }
  for (const r of openByOwner) row(r.ownerId).openDeals += r._count._all;
  for (const r of leadsByOwner) row(r.ownerId).newLeads += r._count._all;

  return {
    period,
    range: { start, end },
    timezone: org.timezone,
    defaultCurrency: org.defaultCurrency,
    kpi: {
      totalLeads,
      newLeads,
      newLeadsPrev: prevNewLeads,
      activeDeals,
      openValue: sumByCurrency(openValue),
      wonValue: sumByCurrency(wonValue),
      customers,
    },
    pipeline: stageSummary,
    leadSeries: series,
    sourcePerf,
    salesPerf: [...perf.values()].sort((a, b) => b.wonCount - a.wonCount),
    activities: { overdueCount, overdue: overdueList, upcoming: upcomingList, recent },
    actionRequired: {
      uncontactedLeads: { count: uncontactedCount, items: uncontactedList },
      overdueFollowUps: { count: overdueCount, items: overdueList },
      dealsWithoutNextActivity: { count: noNextCount, items: noNextList },
      quotationsToFollowUp: {
        count: quoCount,
        items: quoList.map((q) => ({
          id: q.id,
          number: q.number,
          validUntil: q.validUntil.toISOString().slice(0, 10),
        })),
      },
    },
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
