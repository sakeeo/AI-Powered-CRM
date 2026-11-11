import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { forTenant } from "@/lib/tenant";
import { receiveWebhook } from "@/modules/webhooks/server/receive";

/**
 * Endpoint publik webhook masuk (form website → lead). Otentikasi memakai HMAC `X-Signature`,
 * bukan session; tenant ditentukan dari publicId pada URL. Respons sengaja seragam untuk id tak dikenal.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/webhooks/inbound/[publicId]">,
) {
  try {
    const { publicId } = await ctx.params;
    const webhook = await prisma.inboundWebhook.findUnique({
      where: { publicId },
      include: { organization: { select: { defaultCurrency: true, deletedAt: true } } },
    });
    if (!webhook || webhook.organization.deletedAt) {
      return NextResponse.json({ error: "Webhook tidak ditemukan" }, { status: 404 });
    }
    const rawBody = await req.text();
    const result = await receiveWebhook(forTenant(prisma, webhook.organizationId), webhook, {
      rawBody,
      signature: req.headers.get("x-signature"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      defaultCurrency: webhook.organization.defaultCurrency,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return handleRouteError(error, { scope: "webhook.inbound" });
  }
}
