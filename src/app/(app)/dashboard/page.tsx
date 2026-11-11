import type { Metadata } from "next";
import { Briefcase, CircleDollarSign, Handshake, Target, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { PageActions } from "@/components/shared/page-actions";
import { UrlFilterSelect } from "@/components/shared/data-table";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenant } from "@/lib/context";
import { formatMoney } from "@/lib/money";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { formatInTz } from "@/lib/timezone";
import { ActionRequired } from "@/modules/dashboard/components/action-required";
import {
  LeadSeriesChart,
  PipelineChart,
  SourceChart,
} from "@/modules/dashboard/components/dashboard-charts";
import { getDashboard, PERIODS, PERIOD_LABEL } from "@/modules/dashboard/server/metrics";
import { listOwnerOptions, listTeams } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Dashboard" };

const money = (m: Record<string, string>, fallback: string) =>
  Object.keys(m).length
    ? Object.entries(m)
        .map(([c, v]) => formatMoney(v, c))
        .join(" + ")
    : formatMoney(0, fallback);

export default async function Page(props: PageProps<"/dashboard">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const [d, owners, teams] = await Promise.all([
    getDashboard(ctx, {
      period: pickParam(sp, "period"),
      owner: pickParam(sp, "owner"),
      team: pickParam(sp, "team"),
    }),
    listOwnerOptions(ctx),
    listTeams(ctx),
  ]);
  const names = new Map(owners.map((o) => [o.userId, o.name]));
  const delta = d.kpi.newLeadsPrev
    ? Math.round(((d.kpi.newLeads - d.kpi.newLeadsPrev) / d.kpi.newLeadsPrev) * 100)
    : null;
  const canFilterPeople = ctx.role !== "sales_rep" && ctx.role !== "viewer";
  return (
    <div className="space-y-4">
      <PageActions title="Ringkasan" description={PERIOD_LABEL[d.period]}>
        <UrlFilterSelect
          param="period"
          label="Periode"
          allLabel="30 hari terakhir"
          options={PERIODS.filter((p) => p !== "30d").map((p) => ({
            value: p,
            label: PERIOD_LABEL[p],
          }))}
        />
        {canFilterPeople && (
          <>
            <UrlFilterSelect
              param="team"
              label="Filter tim"
              allLabel="Semua tim"
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
            <UrlFilterSelect
              param="owner"
              label="Filter pengguna"
              allLabel="Semua pengguna"
              options={owners.map((o) => ({ value: o.userId, label: o.name }))}
            />
          </>
        )}
      </PageActions>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" data-testid="kpis">
        <StatCard
          icon={Target}
          tone="blue"
          value={String(d.kpi.totalLeads)}
          label="Total lead aktif"
        />
        <StatCard
          icon={TrendingUp}
          tone="green"
          value={String(d.kpi.newLeads)}
          label="Lead baru"
          hint={PERIOD_LABEL[d.period]}
          trend={
            delta === null
              ? undefined
              : { value: `${Math.abs(delta)}%`, direction: delta >= 0 ? "up" : "down" }
          }
        />
        <StatCard
          icon={Handshake}
          tone="orange"
          value={String(d.kpi.activeDeals)}
          label="Deal aktif"
        />
        <StatCard
          icon={Briefcase}
          tone="purple"
          value={money(d.kpi.openValue, d.defaultCurrency)}
          label="Nilai pipeline (deal terbuka)"
        />
        <StatCard
          icon={CircleDollarSign}
          tone="green"
          value={money(d.kpi.wonValue, d.defaultCurrency)}
          label="Nilai deal Won"
          hint={PERIOD_LABEL[d.period]}
        />
        <StatCard icon={Users} tone="blue" value={String(d.kpi.customers)} label="Customer" />
      </div>

      <ActionRequired data={d.actionRequired} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline per stage</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineChart data={d.pipeline.map((s) => ({ name: s.name, deals: s.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lead baru per hari</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadSeriesChart data={d.leadSeries} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas mendatang</CardTitle>
          </CardHeader>
          <CardContent>
            {d.activities.upcoming.length === 0 ? (
              <p className="text-muted-foreground text-xs">Tidak ada aktivitas mendatang.</p>
            ) : (
              <ul className="space-y-1 text-sm" data-testid="upcoming">
                {d.activities.upcoming.map((a) => (
                  <li key={a.id}>
                    {a.subject}{" "}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      · {a.dueAt && formatInTz(a.dueAt, d.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className="text-primary mt-2 inline-block text-xs hover:underline"
              href="/activities"
            >
              Lihat semua
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas terlambat ({d.activities.overdueCount})</CardTitle>
          </CardHeader>
          <CardContent>
            {d.activities.overdue.length === 0 ? (
              <p className="text-muted-foreground text-xs">Tidak ada aktivitas terlambat.</p>
            ) : (
              <ul className="space-y-1 text-sm" data-testid="overdue">
                {d.activities.overdue.map((a) => (
                  <li key={a.id}>
                    {a.subject}{" "}
                    <span className="text-tone-red-ink text-xs tabular-nums">
                      · {a.dueAt && formatInTz(a.dueAt, d.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className="text-primary mt-2 inline-block text-xs hover:underline"
              href="/activities?bucket=overdue"
            >
              Lihat semua
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {d.activities.recent.length === 0 ? (
              <p className="text-muted-foreground text-xs">Belum ada aktivitas.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.activities.recent.map((a) => (
                  <li key={a.id}>
                    {a.subject}{" "}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      · {formatInTz(a.createdAt, d.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performa lead source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.sourcePerf.length === 0 ? (
              <p className="text-muted-foreground text-xs">Belum ada lead pada periode ini.</p>
            ) : (
              <>
                <SourceChart data={d.sourcePerf} />
                <table className="w-full text-sm" data-testid="source-perf">
                  <thead>
                    <tr className="text-muted-foreground text-left text-xs">
                      <th>Sumber</th>
                      <th className="text-right">Lead</th>
                      <th className="text-right">Konversi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.sourcePerf.map((s) => (
                      <tr key={s.sourceId ?? "none"}>
                        <td>{s.name}</td>
                        <td className="text-right tabular-nums">{s.leads}</td>
                        <td className="text-right tabular-nums">{s.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Performa sales</CardTitle>
          </CardHeader>
          <CardContent>
            {d.salesPerf.length === 0 ? (
              <p className="text-muted-foreground text-xs">Belum ada data pada periode ini.</p>
            ) : (
              <table className="w-full text-sm" data-testid="sales-perf">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th>Sales</th>
                    <th className="text-right">Won</th>
                    <th className="text-right">Nilai Won</th>
                    <th className="text-right">Deal terbuka</th>
                    <th className="text-right">Lead baru</th>
                  </tr>
                </thead>
                <tbody>
                  {d.salesPerf.map((p) => (
                    <tr key={p.ownerId ?? "none"}>
                      <td>{p.ownerId ? (names.get(p.ownerId) ?? "—") : "Belum ditugaskan"}</td>
                      <td className="text-right tabular-nums">{p.wonCount}</td>
                      <td className="text-right tabular-nums">
                        {money(p.wonValue, d.defaultCurrency)}
                      </td>
                      <td className="text-right tabular-nums">{p.openDeals}</td>
                      <td className="text-right tabular-nums">{p.newLeads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
