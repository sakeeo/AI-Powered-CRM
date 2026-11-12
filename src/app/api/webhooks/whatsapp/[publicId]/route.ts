import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { forTenant } from "@/lib/tenant";
import { receiveWhatsappWebhook } from "@/modules/whatsapp/server/receive";

/**
 * Webhook pesan masuk WhatsApp. Tenant ditentukan dari publicId (settings connector); otentikasi
 * memakai HMAC `X-Signature` atau `?token=<secret>`. Respons seragam untuk id tak dikenal.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/webhooks/whatsapp/[publicId]">,
) {
  try {
    const { publicId } = await ctx.params;
    const connector = await prisma.tenantConnector.findFirst({
      where: {
        type: { startsWith: "whatsapp_" },
        settings: { path: ["publicId"], equals: publicId },
        organization: { deletedAt: null },
      },
    });
    if (!connector) return NextResponse.json({ error: "Webhook tidak ditemukan" }, { status: 404 });
    const result = await receiveWhatsappWebhook(
      forTenant(prisma, connector.organizationId),
      connector,
      publicId,
      {
        rawBody: await req.text(),
        signature: req.headers.get("x-signature"),
        token: req.nextUrl.searchParams.get("token"),
      },
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return handleRouteError(error, { scope: "webhook.whatsapp" });
  }
}
