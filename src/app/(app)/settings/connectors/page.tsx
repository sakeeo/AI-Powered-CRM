import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { ConnectorHub } from "@/modules/connectors/components/connector-hub";
import { listConnectors } from "@/modules/connectors/server/queries";
import { EmailConnectorCard } from "@/modules/connectors/components/email-connector-card";
import { WebhookCard } from "@/modules/webhooks/components/webhook-card";
import { getWebhookView } from "@/modules/webhooks/server/queries";

export const metadata: Metadata = { title: "Connectors" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Connector")) return <Forbidden what="connector" />;
  const [connectors, webhook] = await Promise.all([listConnectors(ctx), getWebhookView(ctx)]);
  const canManage = ctx.ability.can("update", "Connector");
  return (
    <ConnectorHub
      connectors={connectors}
      canManage={canManage}
      extra={{
        webhook: <WebhookCard webhook={webhook} canManage={canManage} />,
        email: <EmailConnectorCard connectors={connectors} canManage={canManage} />,
      }}
    />
  );
}
