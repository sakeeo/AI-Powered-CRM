import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { getTenantContext } from "@/lib/context";
import { handleRouteError, UnauthorizedError } from "@/lib/errors";
import { putTenantObject } from "@/lib/storage";
import { getOrganization } from "@/modules/organizations/server/queries";
import { renderQuotationPdf } from "@/modules/quotations/pdf/quotation-pdf";
import { getQuotation } from "@/modules/quotations/server/queries";

/**
 * Unduh PDF quotation. Dibuat ulang setiap kali (selalu sesuai data terbaru), disimpan ke object storage
 * per tenant (`<org>/quotations/<id>.pdf`), dan dikirim sebagai lampiran. Hanya yang boleh melihat quotation.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/quotations/[id]/pdf">) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) throw UnauthorizedError();
    const { id } = await ctx.params;
    const q = await getQuotation(tenant, id); // scope izin + tenant, 404 bila tidak boleh
    const org = await getOrganization(tenant);
    const pdf = await renderQuotationPdf(q, org.name);
    const key = await putTenantObject(
      tenant.organizationId,
      `quotations/${q.id}.pdf`,
      pdf,
      "application/pdf",
    );
    await tenant.db.quotation.update({
      where: { id: q.id },
      data: { pdfKey: key, pdfGeneratedAt: new Date() },
    });
    await writeAudit(tenant, {
      action: "quotation.pdf_generated",
      entityType: "Quotation",
      entityId: q.id,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${q.number}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, { scope: "quotation.pdf" });
  }
}
