import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { ConnectorHub } from "@/modules/connectors/components/connector-hub";
import { listConnectors } from "@/modules/connectors/server/queries";
import {
  listOutboundDeliveries,
  listOutboundWebhooks,
} from "@/modules/integrations/server/queries";
import { getWebhookView } from "@/modules/webhooks/server/queries";

export const metadata: Metadata = { title: "Connectors" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Connector")) return <Forbidden what="connector" />;
  const [connectors, webhook, outbound, deliveries] = await Promise.all([
    listConnectors(ctx),
    getWebhookView(ctx),
    listOutboundWebhooks(ctx),
    listOutboundDeliveries(ctx),
  ]);
  const canManage = ctx.ability.can("update", "Connector");
  return (
    <ConnectorHub
      connectors={connectors}
      canManage={canManage}
      webhook={webhook}
      outbound={outbound}
      deliveries={deliveries}
    />
  );
}
