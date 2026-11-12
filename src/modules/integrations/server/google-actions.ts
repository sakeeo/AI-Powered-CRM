"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { GoogleRateLimitError, SCOPE_GMAIL, pullCalendar, syncGmail } from "@/lib/google";
import { rateLimit } from "@/lib/rate-limit";

async function mine(ctx: Parameters<Parameters<typeof tenantAction>[1]>[0]) {
  const integ = await ctx.db.googleIntegration.findFirst({ where: { userId: ctx.userId } });
  if (!integ) throw new AppError("Google belum terhubung", 404, "not_found");
  return integ;
}

/** Atur fitur sinkronisasi milik sendiri. Email hanya bisa diaktifkan bila izin Gmail sudah diberikan. */
export const updateGoogleOptions = tenantAction(
  z.object({ syncCalendar: z.boolean(), syncEmail: z.boolean() }),
  async (ctx, input) => {
    const integ = await mine(ctx);
    if (input.syncEmail && !integ.scopes.includes(SCOPE_GMAIL))
      throw new AppError("Hubungkan ulang dengan izin Gmail untuk mengaktifkan sinkron email");
    await ctx.db.googleIntegration.update({
      where: { id: integ.id },
      data: {
        syncCalendar: input.syncCalendar,
        syncEmail: input.syncEmail,
        ...(input.syncEmail && !integ.syncEmail ? { emailSyncedAt: new Date() } : {}),
      },
    });
    await writeAudit(ctx, {
      action: "google.options_changed",
      entityType: "Integration",
      entityId: ctx.userId,
      after: input,
    });
    revalidatePath("/settings/integrations");
  },
);

/** Putuskan Google: token dicabut di Google (best-effort) dan seluruh data tautan dihapus. */
export const disconnectGoogle = tenantAction(z.object({}), async (ctx) => {
  const integ = await mine(ctx);
  try {
    const token = decryptSecret(
      integ.refreshTokenEncrypted,
      `${integ.organizationId}:${integ.userId}:google`,
    );
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* pencabutan di sisi Google bersifat best-effort */
  }
  await ctx.db.googleIntegration.delete({ where: { id: integ.id } });
  await writeAudit(ctx, {
    action: "google.disconnected",
    entityType: "Integration",
    entityId: ctx.userId,
  });
  revalidatePath("/settings/integrations");
});

/** Sinkronisasi manual (dibatasi 6x/jam per pengguna). */
export const syncGoogleNow = tenantAction(z.object({}), async (ctx) => {
  const integ = await mine(ctx);
  const rl = await rateLimit(`google-sync:${ctx.userId}`, 6, 3600);
  if (!rl.allowed) throw new AppError("Terlalu sering. Coba lagi nanti.", 429, "rate_limited");
  try {
    const cal = integ.syncCalendar ? await pullCalendar(integ.id) : { changed: 0 };
    const mail = integ.syncEmail ? await syncGmail(integ.id) : { logged: 0 };
    revalidatePath("/settings/integrations");
    return { changed: cal.changed, logged: mail.logged };
  } catch (e) {
    if (e instanceof GoogleRateLimitError) throw new AppError(e.message, 429, "rate_limited");
    throw new AppError((e as Error).message || "Sinkronisasi gagal");
  }
});
