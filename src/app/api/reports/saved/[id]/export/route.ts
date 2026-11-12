import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { getTenantContext } from "@/lib/context";
import { handleRouteError, UnauthorizedError } from "@/lib/errors";
import { executePlan } from "@/modules/insights/server/execute";
import { renderCsv, renderXlsx } from "@/modules/import-export/server/export";
import { getOrganization } from "@/modules/organizations/server/queries";
import { getSavedReport } from "@/modules/reports/server/saved-queries";
import { safeCell } from "@/lib/csv";

/** Export laporan kustom tersimpan. Dihitung dengan izin pengguna yang mengunduh; butuh izin export Report. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/reports/saved/[id]/export">) {
  try {
    const { id } = await ctx.params;
    const tenant = await getTenantContext();
    if (!tenant) throw UnauthorizedError();
    assertCan(tenant, "export", "Report");
    const saved = await getSavedReport(tenant, id);
    const { timezone } = await getOrganization(tenant);
    const result = await executePlan(tenant, saved.definition, timezone);
    const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    await writeAudit(
      { ...tenant, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() },
      { action: "report.exported", entityType: "SavedReport", entityId: id, after: { format } },
    );
    const data = { columns: result.columns, rows: result.rows.map((r) => r.map(safeCell)) };
    const filename = `laporan-${saved.name.replace(/[^\w-]+/g, "_").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.${format}`;
    const headers = {
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    };
    if (format === "xlsx") {
      return new NextResponse(new Uint8Array(await renderXlsx(data, "Laporan")), {
        headers: {
          ...headers,
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }
    return new NextResponse(await renderCsv(data), {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8" },
    });
  } catch (error) {
    return handleRouteError(error, { scope: "report.saved.export" });
  }
}
