import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { ConnectorHub } from "@/modules/connectors/components/connector-hub";
import { listConnectors } from "@/modules/connectors/server/queries";

export const metadata: Metadata = { title: "Connectors" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Connector")) return <Forbidden what="connector" />;
  const connectors = await listConnectors(ctx);
  return (
    <ConnectorHub connectors={connectors} canManage={ctx.ability.can("update", "Connector")} />
  );
}
