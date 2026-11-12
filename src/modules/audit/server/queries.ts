import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { prisma } from "@/lib/prisma";

export const AUDIT_PAGE_SIZE = 10;

export async function listAuditLogs(
  ctx: TenantContext,
  {
    page = 1,
    pageSize = AUDIT_PAGE_SIZE,
    entityType,
  }: { page?: number; pageSize?: number; entityType?: string },
) {
  assertCan(ctx, "view", "AuditLog");
  const where = entityType ? { entityType } : {};
  const [total, rows, types] = await Promise.all([
    ctx.db.auditLog.count({ where }),
    ctx.db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(page, 1) - 1) * pageSize,
      take: pageSize,
    }),
    ctx.db.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
  const users = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    entityTypes: types.map((t) => t.entityType),
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actorId ? (names.get(r.actorId) ?? "Pengguna dihapus") : "Sistem",
      ip: r.ipAddress,
      createdAt: r.createdAt,
      before: r.before,
      after: r.after,
    })),
  };
}
