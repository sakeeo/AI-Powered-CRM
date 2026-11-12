import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";

/**
 * Daftar anomali terbuka. Sales Rep hanya melihat anomali pelanggan yang ia miliki; peran lain melihat semua
 * (termasuk insight tingkat organisasi).
 */
export async function listInsightAlerts(ctx: TenantContext, opts: { take?: number } = {}) {
  assertCan(ctx, "view", "Report");
  return ctx.db.insightAlert.findMany({
    where: {
      status: "open",
      ...(ctx.role === "sales_rep" ? { ownerId: ctx.userId } : {}),
    },
    orderBy: [{ detectedAt: "desc" }],
    take: opts.take ?? 50,
  });
}
