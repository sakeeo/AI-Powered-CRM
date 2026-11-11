import type { Metadata } from "next";
import Link from "next/link";
import { Forbidden } from "@/components/shared/forbidden";
import { PageActions } from "@/components/shared/page-actions";
import { UrlFilterSelect } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenant } from "@/lib/context";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { PERIODS, PERIOD_LABEL } from "@/modules/dashboard/server/metrics";
import { ExportReportButton } from "@/modules/reports/components/export-report-button";
import { REPORT_LABEL, REPORT_TYPES, type ReportType } from "@/modules/reports/constants";
import { getReport } from "@/modules/reports/server/reports";
import { listOwnerOptions, listTeams } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Reports & Analytics" };

export default async function Page(props: PageProps<"/reports">) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Report")) return <Forbidden what="laporan" />;
  const sp = (await props.searchParams) as SearchParams;
  const raw = pickParam(sp, "type");
  const type: ReportType = (REPORT_TYPES as readonly string[]).includes(raw ?? "")
    ? (raw as ReportType)
    : "lead";
  const [report, owners, teams] = await Promise.all([
    getReport(ctx, type, {
      period: pickParam(sp, "period"),
      owner: pickParam(sp, "owner"),
      team: pickParam(sp, "team"),
    }),
    listOwnerOptions(ctx),
    listTeams(ctx),
  ]);
  const canFilterPeople = ctx.role !== "sales_rep" && ctx.role !== "viewer";
  const keep = ["period", "owner", "team"]
    .map((k) => [k, pickParam(sp, k)] as const)
    .filter(([, v]) => v);
  const href = (t: ReportType) =>
    `/reports?${new URLSearchParams([["type", t], ...(keep as [string, string][])])}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Jenis laporan">
        {REPORT_TYPES.map((t) => (
          <Button key={t} asChild size="sm" variant={t === type ? "default" : "outline"}>
            <Link href={href(t)} role="tab" aria-selected={t === type}>
              {REPORT_LABEL[t]}
            </Link>
          </Button>
        ))}
      </div>
      <PageActions title={report.title} description={report.periodLabel}>
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
        <ExportReportButton type={type} />
      </PageActions>
      {report.note && (
        <p
          className="bg-tone-orange-soft border-tone-orange-border text-tone-orange-ink rounded-lg border p-3 text-sm"
          data-testid="report-note"
        >
          {report.note}
        </p>
      )}
      {report.sections.map((s) => (
        <Card key={s.title}>
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 overflow-x-auto">
            {s.rows.length === 0 ? (
              <p className="text-muted-foreground text-xs">Tidak ada data pada periode ini.</p>
            ) : (
              <table className="w-full text-sm" data-testid="report-table">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    {s.columns.map((c) => (
                      <th key={c} className="py-1.5 pr-3 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {r.map((c, j) => (
                        <td key={j} className="py-1.5 pr-3 tabular-nums">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.note && <p className="text-muted-foreground text-xs">{s.note}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
