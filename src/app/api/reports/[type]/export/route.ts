import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { getTenantContext } from "@/lib/context";
import { AppError, handleRouteError, UnauthorizedError } from "@/lib/errors";
import { REPORT_TYPES, type ReportType } from "@/modules/reports/constants";
import { reportToCsv, reportToXlsx } from "@/modules/reports/server/export";
import { getReport } from "@/modules/reports/server/reports";

/** Export laporan (CSV/XLSX) dengan filter yang sama seperti halaman. Butuh izin export Report (Sales Rep/Viewer ditolak). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/reports/[type]/export">) {
  try {
    const { type } = await ctx.params;
    if (!(REPORT_TYPES as readonly string[]).includes(type))
      throw new AppError("Laporan tidak dikenal", 404, "not_found");
    const tenant = await getTenantContext();
    if (!tenant) throw UnauthorizedError();
    assertCan(tenant, "export", "Report");
    const sp = req.nextUrl.searchParams;
    const report = await getReport(tenant, type as ReportType, {
      period: sp.get("period") ?? undefined,
      owner: sp.get("owner") ?? undefined,
      team: sp.get("team") ?? undefined,
    });
    const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
    await writeAudit(
      { ...tenant, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() },
      { action: "report.exported", entityType: "Report", entityId: type, after: { format } },
    );
    const filename = `laporan-${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
    const headers = {
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    };
    if (format === "xlsx") {
      return new NextResponse(new Uint8Array(await reportToXlsx(report)), {
        headers: {
          ...headers,
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }
    return new NextResponse(reportToCsv(report), {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8" },
    });
  } catch (error) {
    return handleRouteError(error, { scope: "report.export" });
  }
}
