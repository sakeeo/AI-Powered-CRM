import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";

/** Status webhook untuk UI. `secretEncrypted` tidak pernah dipilih. */
export async function getWebhookView(ctx: TenantContext) {
  assertCan(ctx, "view", "Connector");
  const hook = await ctx.db.inboundWebhook.findFirst({
    select: { publicId: true, maskedHint: true, isActive: true, lastReceivedAt: true },
  });
  if (!hook) return null;
  const deliveries = await ctx.db.webhookDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      httpStatus: true,
      error: true,
      leadId: true,
      createdAt: true,
    },
  });
  return { ...hook, deliveries };
}
export type WebhookView = NonNullable<Awaited<ReturnType<typeof getWebhookView>>>;
