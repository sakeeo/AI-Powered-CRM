import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { formatMoney } from "@/lib/money";
import { dateInTz } from "@/lib/timezone";
import { getDefaultPipeline, pipelineSummary } from "@/modules/deals/server/queries";
import { resolveFilters, type DashboardFilters } from "@/modules/dashboard/server/metrics";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/modules/leads/constants";
import { listOwnerOptions } from "@/modules/organizations/server/queries";
import { ACTIVITY_TYPE_LABEL, type ActivityType } from "@/modules/activities/constants";
import { REPORT_LABEL, UNCATEGORIZED, type ReportType } from "@/modules/reports/constants";

export type Cell = string | number;
export type Section = { title: string; columns: string[]; rows: Cell[][]; note?: string };
export type Report = {
  type: ReportType;
  title: string;
  periodLabel: string;
  sections: Section[];
  note?: string;
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");
const money = (m: Record<string, string>) =>
  Object.keys(m).length
    ? Object.entries(m)
        .map(([c, v]) => formatMoney(v, c))
        .join(" + ")
    : "—";
const add = (m: Record<string, string>, cur: string, v: { toString(): string } | null) => {
  m[cur] = new Decimal(m[cur] ?? 0).plus(v?.toString() ?? 0).toFixed(2);
};

/**
 * Laporan inti. Semua laporan memakai filter & definisi yang sama dengan dashboard (docs/metrics.md),
 * dibatasi izin pengguna (scopeWhere). Nilai deal Won ≠ cash received / pendapatan akuntansi.
 */
export async function getReport(
  ctx: TenantContext,
  type: ReportType,
  filters: DashboardFilters = {},
  now = new Date(),
): Promise<Report> {
  const f = await resolveFilters(ctx, filters, now);
  const { start, end, ownerWhere, ownerIds, org } = f;
  const tz = org.timezone;
  const leadScope = scopeWhere(ctx, "view", "Lead") as Prisma.LeadWhereInput;
  const dealScope = scopeWhere(ctx, "view", "Deal") as Prisma.DealWhereInput;
  const actScope = scopeWhere(ctx, "view", "Activity") as Prisma.ActivityWhereInput;
  const leads = (extra: Prisma.LeadWhereInput = {}): Prisma.LeadWhereInput => ({
    AND: [{ archivedAt: null }, leadScope, ownerWhere, extra],
  });
  const deals = (extra: Prisma.DealWhereInput = {}): Prisma.DealWhereInput => ({
    AND: [{ deletedAt: null }, dealScope, ownerWhere, extra],
  });
  const periodLabel = `${dateInTz(start, tz)} s.d. ${dateInTz(end, tz)}`;
  const base = { type, title: REPORT_LABEL[type], periodLabel };
  const owners = new Map((await listOwnerOptions(ctx)).map((o) => [o.userId, o.name]));
  const ownerName = (id: string | null) => (id ? (owners.get(id) ?? "—") : "Belum ditugaskan");

  switch (type) {
    case "lead": {
      const grouped = await ctx.db.lead.groupBy({
        by: ["status"],
        where: leads({ createdAt: { gte: start, lte: end } }),
        _count: { _all: true },
      });
      const total = grouped.reduce((n, g) => n + g._count._all, 0);
      return {
        ...base,
        sections: [
          {
            title: "Lead dibuat pada periode, per status",
            columns: ["Status", "Jumlah", "Persentase"],
            rows: [
              ...grouped.map(
                (g) =>
                  [
                    LEAD_STATUS_LABEL[g.status as LeadStatus] ?? g.status,
                    g._count._all,
                    pct(g._count._all, total),
                  ] as Cell[],
              ),
              ["Total", total, total ? "100%" : "—"],
            ],
          },
        ],
      };
    }
    case "pipeline": {
      const pipeline = await getDefaultPipeline(ctx);
      const summary = await pipelineSummary(ctx, pipeline.id, ownerIds ? { ownerIds } : {});
      const totals: Record<string, string> = {};
      const weighted: Record<string, string> = {};
      let count = 0;
      for (const s of summary) {
        count += s.count;
        for (const [c, v] of Object.entries(s.totals)) add(totals, c, { toString: () => v });
        for (const [c, v] of Object.entries(s.weighted)) add(weighted, c, { toString: () => v });
      }
      return {
        ...base,
        periodLabel: "Kondisi saat ini (deal terbuka)",
        sections: [
          {
            title: "Pipeline terbuka per stage",
            columns: ["Stage", "Deal terbuka", "Nilai total", "Nilai tertimbang probabilitas"],
            rows: [
              ...summary.map(
                (s) => [s.name, s.count, money(s.totals), money(s.weighted)] as Cell[],
              ),
              ["Total", count, money(totals), money(weighted)],
            ],
          },
        ],
      };
    }
    case "winlost": {
      const closed = await ctx.db.deal.findMany({
        where: deals({ status: { in: ["won", "lost"] }, closedAt: { gte: start, lte: end } }),
        orderBy: { closedAt: "desc" },
        take: 5000,
        select: {
          title: true,
          status: true,
          value: true,
          currency: true,
          closedAt: true,
          lostReason: true,
          lostCategory: true,
          ownerId: true,
        },
      });
      const won = { n: 0, v: {} as Record<string, string> };
      const lost = { n: 0, v: {} as Record<string, string> };
      const cats = new Map<string, { n: number; v: Record<string, string> }>();
      for (const d of closed) {
        const bucket = d.status === "won" ? won : lost;
        bucket.n++;
        add(bucket.v, d.currency, d.value);
        if (d.status === "lost") {
          const k = d.lostCategory ?? UNCATEGORIZED;
          const c = cats.get(k) ?? { n: 0, v: {} };
          c.n++;
          add(c.v, d.currency, d.value);
          cats.set(k, c);
        }
      }
      return {
        ...base,
        sections: [
          {
            title: "Ringkasan",
            columns: ["Hasil", "Jumlah deal", "Nilai deal", "Win rate"],
            rows: [
              ["Won", won.n, money(won.v), pct(won.n, won.n + lost.n)],
              ["Lost", lost.n, money(lost.v), "—"],
            ],
            note: "Win rate = Won ÷ (Won + Lost) untuk deal yang ditutup pada periode.",
          },
          {
            title: "Alasan Lost per kategori",
            columns: ["Kategori", "Jumlah", "Nilai deal", "Persentase"],
            rows: [...cats.entries()]
              .sort((a, b) => b[1].n - a[1].n)
              .map(([k, c]) => [k, c.n, money(c.v), pct(c.n, lost.n)] as Cell[]),
          },
          {
            title: "Daftar deal ditutup",
            columns: [
              "Deal",
              "Hasil",
              "Nilai",
              "Mata uang",
              "Ditutup",
              "Alasan Lost",
              "Kategori",
              "Owner",
            ],
            rows: closed.map((d) => [
              d.title,
              d.status === "won" ? "Won" : "Lost",
              d.value.toFixed(2),
              d.currency,
              d.closedAt ? dateInTz(d.closedAt, tz) : "",
              d.lostReason ?? "",
              d.status === "lost" ? (d.lostCategory ?? UNCATEGORIZED) : "",
              ownerName(d.ownerId),
            ]),
          },
        ],
      };
    }
    case "conversion":
    case "source": {
      const rows = await ctx.db.lead.findMany({
        where: leads({ createdAt: { gte: start, lte: end } }),
        select: { sourceId: true, status: true, convertedAt: true, convertedDealId: true },
        take: 20000,
      });
      const dealIds = rows.map((r) => r.convertedDealId).filter((x): x is string => !!x);
      const wonDeals = new Set(
        (
          await ctx.db.deal.findMany({
            where: { id: { in: dealIds }, status: "won", deletedAt: null },
            select: { id: true },
          })
        ).map((d) => d.id),
      );
      const note =
        "Cohort: lead yang dibuat pada periode. Pembagi semua persentase = jumlah lead cohort tersebut.";
      if (type === "conversion") {
        const total = rows.length;
        const qualified = rows.filter((r) => r.status === "qualified" || r.convertedAt).length;
        const converted = rows.filter((r) => r.convertedAt).length;
        const won = rows.filter((r) => r.convertedDealId && wonDeals.has(r.convertedDealId)).length;
        return {
          ...base,
          sections: [
            {
              title: "Funnel konversi lead (cohort)",
              columns: ["Tahap", "Jumlah", "% dari lead dibuat"],
              rows: [
                ["Lead dibuat", total, total ? "100%" : "—"],
                ["Qualified (atau sudah dikonversi)", qualified, pct(qualified, total)],
                ["Dikonversi menjadi deal/contact", converted, pct(converted, total)],
                ["Deal Won", won, pct(won, total)],
              ],
              note,
            },
          ],
        };
      }
      const sources = new Map(
        (await ctx.db.leadSource.findMany({ select: { id: true, name: true } })).map((s) => [
          s.id,
          s.name,
        ]),
      );
      const by = new Map<string, { n: number; conv: number; won: number }>();
      for (const r of rows) {
        const k = r.sourceId ?? "";
        const e = by.get(k) ?? { n: 0, conv: 0, won: 0 };
        e.n++;
        if (r.convertedAt) e.conv++;
        if (r.convertedDealId && wonDeals.has(r.convertedDealId)) e.won++;
        by.set(k, e);
      }
      return {
        ...base,
        sections: [
          {
            title: "Performa lead source (cohort)",
            columns: ["Sumber", "Lead", "Terkonversi", "Konversi", "Deal Won", "Win dari lead"],
            rows: [...by.entries()]
              .sort((a, b) => b[1].n - a[1].n)
              .map(
                ([k, e]) =>
                  [
                    k ? (sources.get(k) ?? "—") : "Tanpa sumber",
                    e.n,
                    e.conv,
                    pct(e.conv, e.n),
                    e.won,
                    pct(e.won, e.n),
                  ] as Cell[],
              ),
            note,
          },
        ],
      };
    }
    case "sales": {
      const [wonG, lostG, openG, leadG, doneG] = await Promise.all([
        ctx.db.deal.groupBy({
          by: ["ownerId", "currency"],
          where: deals({ status: "won", closedAt: { gte: start, lte: end } }),
          _sum: { value: true },
          _count: { _all: true },
        }),
        ctx.db.deal.groupBy({
          by: ["ownerId"],
          where: deals({ status: "lost", closedAt: { gte: start, lte: end } }),
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
        ctx.db.activity.groupBy({
          by: ["ownerId"],
          where: {
            AND: [actScope, ownerWhere, { status: "done", completedAt: { gte: start, lte: end } }],
          },
          _count: { _all: true },
        }),
      ]);
      const m = new Map<
        string,
        {
          id: string | null;
          won: number;
          wonV: Record<string, string>;
          lost: number;
          open: number;
          leads: number;
          done: number;
        }
      >();
      const row = (id: string | null) => {
        const k = id ?? "";
        if (!m.has(k)) m.set(k, { id, won: 0, wonV: {}, lost: 0, open: 0, leads: 0, done: 0 });
        return m.get(k)!;
      };
      for (const r of wonG) {
        const e = row(r.ownerId);
        e.won += r._count._all;
        add(e.wonV, r.currency, r._sum.value);
      }
      for (const r of lostG) row(r.ownerId).lost += r._count._all;
      for (const r of openG) row(r.ownerId).open += r._count._all;
      for (const r of leadG) row(r.ownerId).leads += r._count._all;
      for (const r of doneG) row(r.ownerId).done += r._count._all;
      return {
        ...base,
        sections: [
          {
            title: "Performa sales per pemilik",
            columns: [
              "Sales",
              "Lead baru",
              "Deal Won",
              "Nilai Won",
              "Deal Lost",
              "Win rate",
              "Deal terbuka",
              "Aktivitas selesai",
            ],
            rows: [...m.values()]
              .sort((a, b) => b.won - a.won)
              .map(
                (e) =>
                  [
                    ownerName(e.id),
                    e.leads,
                    e.won,
                    money(e.wonV),
                    e.lost,
                    pct(e.won, e.won + e.lost),
                    e.open,
                    e.done,
                  ] as Cell[],
              ),
            note: "Win rate = Won ÷ (Won + Lost) yang ditutup pada periode. Deal terbuka = kondisi saat ini.",
          },
        ],
      };
    }
    case "activity": {
      const now2 = end;
      const groups = await ctx.db.activity.groupBy({
        by: ["type", "status"],
        where: { AND: [actScope, ownerWhere, { createdAt: { gte: start, lte: end } }] },
        _count: { _all: true },
      });
      const overdue = await ctx.db.activity.groupBy({
        by: ["type"],
        where: {
          AND: [
            actScope,
            ownerWhere,
            { createdAt: { gte: start, lte: end }, status: "open", dueAt: { lt: now2 } },
          ],
        },
        _count: { _all: true },
      });
      const t = new Map<
        string,
        { created: number; done: number; open: number; cancelled: number; overdue: number }
      >();
      const e = (k: string) => {
        if (!t.has(k)) t.set(k, { created: 0, done: 0, open: 0, cancelled: 0, overdue: 0 });
        return t.get(k)!;
      };
      for (const g of groups) {
        const x = e(g.type);
        x.created += g._count._all;
        x[g.status as "done" | "open" | "cancelled"] += g._count._all;
      }
      for (const o of overdue) e(o.type).overdue += o._count._all;
      const sum = { created: 0, done: 0, open: 0, cancelled: 0, overdue: 0 };
      for (const v of t.values())
        for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += v[k];
      return {
        ...base,
        sections: [
          {
            title: "Aktivitas dibuat pada periode, per jenis",
            columns: [
              "Jenis",
              "Dibuat",
              "Selesai",
              "Terbuka",
              "Terlambat",
              "Dibatalkan",
              "Tingkat selesai",
            ],
            rows: [
              ...[...t.entries()].map(
                ([k, v]) =>
                  [
                    ACTIVITY_TYPE_LABEL[k as ActivityType] ?? k,
                    v.created,
                    v.done,
                    v.open,
                    v.overdue,
                    v.cancelled,
                    pct(v.done, v.created),
                  ] as Cell[],
              ),
              [
                "Total",
                sum.created,
                sum.done,
                sum.open,
                sum.overdue,
                sum.cancelled,
                pct(sum.done, sum.created),
              ],
            ],
            note: "Tingkat selesai = Selesai ÷ Dibuat (aktivitas yang dibuat pada periode). Terlambat = masih terbuka dan lewat tenggat.",
          },
        ],
      };
    }
    case "revenue": {
      const won = await ctx.db.deal.findMany({
        where: deals({ status: "won", closedAt: { gte: start, lte: end } }),
        select: { value: true, currency: true, closedAt: true },
        take: 20000,
      });
      const by = new Map<string, { n: number; v: Record<string, string> }>();
      const tot = { n: 0, v: {} as Record<string, string> };
      for (const d of won) {
        const month = dateInTz(d.closedAt!, tz).slice(0, 7);
        const e = by.get(month) ?? { n: 0, v: {} };
        e.n++;
        add(e.v, d.currency, d.value);
        by.set(month, e);
        tot.n++;
        add(tot.v, d.currency, d.value);
      }
      return {
        ...base,
        note: "Nilai deal Won adalah nilai kesepakatan penjualan di CRM — BUKAN uang yang sudah diterima (cash received) maupun pendapatan menurut akuntansi.",
        sections: [
          {
            title: "Nilai deal Won per bulan",
            columns: ["Bulan", "Deal Won", "Nilai deal Won"],
            rows: [
              ...[...by.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([k, e]) => [k, e.n, money(e.v)] as Cell[]),
              ["Total", tot.n, money(tot.v)],
            ],
          },
        ],
      };
    }
  }
}
