import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";

/** Daftar connector untuk UI. `configEncrypted` TIDAK PERNAH dipilih (select eksplisit). */
export async function listConnectors(ctx: TenantContext) {
  assertCan(ctx, "view", "Connector");
  const rows = await ctx.db.tenantConnector.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      type: true,
      maskedHint: true,
      settings: true,
      status: true,
      isDefault: true,
      lastTestedAt: true,
      lastTestOk: true,
      lastTestError: true,
    },
  });
  return rows.map((r) => ({
    type: r.type,
    maskedHint: r.maskedHint,
    model: (r.settings as { model?: string } | null)?.model ?? null,
    status: r.status,
    isDefault: r.isDefault,
    lastTestedAt: r.lastTestedAt,
    lastTestOk: r.lastTestOk,
    lastTestError: r.lastTestError,
  }));
}
export type ConnectorView = Awaited<ReturnType<typeof listConnectors>>[number];
