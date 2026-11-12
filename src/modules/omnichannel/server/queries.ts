import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import {
  CHANNEL_KINDS,
  type ChannelKind,
  type RoutingStrategy,
} from "@/modules/omnichannel/constants";

export type RoutingRow = { kind: ChannelKind; strategy: RoutingStrategy; pool: string[] };

/** Aturan routing semua kanal (default "none" untuk kanal yang belum diatur). */
export async function listRouting(ctx: TenantContext): Promise<RoutingRow[]> {
  assertCan(ctx, "view", "Automation");
  const rows = await ctx.db.channelRouting.findMany();
  return CHANNEL_KINDS.map((kind) => {
    const r = rows.find((x) => x.kind === kind);
    return {
      kind,
      strategy: (r?.strategy ?? "none") as RoutingStrategy,
      pool: Array.isArray(r?.pool) ? (r!.pool as string[]) : [],
    };
  });
}
