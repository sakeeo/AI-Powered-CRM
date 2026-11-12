import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { RoutingPanel } from "@/modules/omnichannel/components/routing-panel";
import { listRouting } from "@/modules/omnichannel/server/queries";
import { listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Routing percakapan" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Automation")) return <Forbidden what="routing percakapan" />;
  const [rows, owners] = await Promise.all([listRouting(ctx), listOwnerOptions(ctx)]);
  return (
    <RoutingPanel rows={rows} owners={owners} canEdit={ctx.ability.can("manage", "Automation")} />
  );
}
