"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { idInput } from "@/lib/schema-helpers";

/** Hanya notifikasi milik pengguna sendiri yang bisa ditandai (userId selalu ikut di where). */
export const markNotificationRead = tenantAction(idInput, async (ctx, { id }) => {
  await ctx.db.notification.updateMany({
    where: { id, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
});

export const markAllNotificationsRead = tenantAction(z.object({}), async (ctx) => {
  await ctx.db.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
});

const prefSchema = z.object({ inApp: z.boolean(), email: z.boolean() });
export const setNotificationPreferences = tenantAction(prefSchema, async (ctx, input) => {
  const existing = await ctx.db.notificationPreference.findFirst({ where: { userId: ctx.userId } });
  if (existing) {
    await ctx.db.notificationPreference.update({ where: { id: existing.id }, data: input });
  } else {
    await ctx.db.notificationPreference.create({
      data: { ...input, userId: ctx.userId } as never,
    });
  }
  revalidatePath("/notifications");
});
