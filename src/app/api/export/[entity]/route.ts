import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/context";
import { AppError, handleRouteError, UnauthorizedError } from "@/lib/errors";
import { EXPORT_ENTITIES, type ExportEntity } from "@/modules/import-export/schemas";
import {
  auditExport,
  buildDataset,
  renderCsv,
  renderXlsx,
} from "@/modules/import-export/server/export";

/** Export CSV/XLSX dengan filter aktif. Memerlukan session + izin `export` (Sales Rep/Viewer ditolak). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/export/[entity]">) {
  try {
    const { entity } = await ctx.params;
    if (!(EXPORT_ENTITIES as readonly string[]).includes(entity))
      throw new AppError("Entitas tidak dikenal", 404, "not_found");
    const tenant = await getTenantContext();
    if (!tenant) throw UnauthorizedError();

    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const format = sp.format === "xlsx" ? "xlsx" : "csv";
    const data = await buildDataset(tenant, entity as ExportEntity, sp);
    await auditExport(
      { ...tenant, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() },
      entity as ExportEntity,
      format,
      data.rows.length,
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${entity}-${stamp}.${format}`;
    const headers = {
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    };
    if (format === "xlsx") {
      const buf = await renderXlsx(data, entity);
      return new NextResponse(new Uint8Array(buf), {
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
    return handleRouteError(error, { scope: "export" });
  }
}
