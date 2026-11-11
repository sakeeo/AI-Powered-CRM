import type { TenantContext } from "@/lib/context";

/** Notifikasi milik pengguna yang login (selalu per-user, bukan per-peran). */
export async function listMyNotifications(ctx: TenantContext, limit = 8) {
  return ctx.db.notification.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      readAt: true,
      createdAt: true,
    },
  });
}
export type NotificationView = Awaited<ReturnType<typeof listMyNotifications>>[number];

export function countUnread(ctx: TenantContext) {
  return ctx.db.notification.count({ where: { userId: ctx.userId, readAt: null } });
}

export async function getPreferences(ctx: TenantContext) {
  const p = await ctx.db.notificationPreference.findFirst({ where: { userId: ctx.userId } });
  return { inApp: p?.inApp ?? true, email: p?.email ?? true };
}
