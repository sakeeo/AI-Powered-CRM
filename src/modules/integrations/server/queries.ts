import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import type { OutboundEvent, OutboundProvider } from "@/modules/integrations/constants";

export type OutboundWebhookView = {
  id: string;
  name: string;
  provider: OutboundProvider;
  url: string;
  events: OutboundEvent[];
  isActive: boolean;
  maskedHint: string;
  lastDeliveryAt: Date | null;
  stats: { success: number; failed: number; pending: number };
};

/** Daftar webhook keluar; `secretEncrypted` tidak pernah dipilih. */
export async function listOutboundWebhooks(ctx: TenantContext): Promise<OutboundWebhookView[]> {
  assertCan(ctx, "view", "Connector");
  const [rows, groups] = await Promise.all([
    ctx.db.outboundWebhook.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        provider: true,
        url: true,
        events: true,
        isActive: true,
        maskedHint: true,
        lastDeliveryAt: true,
      },
    }),
    ctx.db.outboundDelivery.groupBy({ by: ["webhookId", "status"], _count: { _all: true } }),
  ]);
  return rows.map((r) => {
    const stats = { success: 0, failed: 0, pending: 0 };
    for (const g of groups) {
      if (g.webhookId === r.id && g.status in stats)
        stats[g.status as keyof typeof stats] = g._count._all;
    }
    return {
      ...r,
      provider: r.provider as OutboundProvider,
      events: (Array.isArray(r.events) ? r.events : []) as OutboundEvent[],
      stats,
    };
  });
}

export async function listOutboundDeliveries(ctx: TenantContext, webhookId?: string) {
  assertCan(ctx, "view", "Connector");
  return ctx.db.outboundDelivery.findMany({
    where: webhookId ? { webhookId } : {},
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      webhookId: true,
      event: true,
      status: true,
      attempts: true,
      httpStatus: true,
      error: true,
      createdAt: true,
    },
  });
}
