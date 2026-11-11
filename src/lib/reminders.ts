import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const DUE_SOON_MS = 30 * 60_000;
const OVERDUE_WINDOW_MS = 7 * 86_400_000;

/**
 * Pindai task yang segera jatuh tempo / terlambat dan buat notifikasi + email.
 * Idempoten: `dedupeKey` unik per (org, user) sehingga pemindaian berulang (atau dua worker) tidak
 * menghasilkan notifikasi/email ganda; email hanya dikirim untuk notifikasi yang BARU dibuat.
 * Berjalan lintas tenant (proses worker), jadi organizationId selalu eksplisit.
 */
export async function scanReminders(now = new Date()) {
  const rows = await prisma.activity.findMany({
    where: {
      status: "open",
      ownerId: { not: null },
      dueAt: {
        not: null,
        lt: new Date(now.getTime() + DUE_SOON_MS),
        gt: new Date(now.getTime() - OVERDUE_WINDOW_MS),
      },
    },
    select: { id: true, organizationId: true, ownerId: true, subject: true, dueAt: true },
    take: 1000,
  });
  if (!rows.length) return { created: 0, emailed: 0 };

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.ownerId!))] } },
  });
  const pref = new Map(prefs.map((p) => [`${p.organizationId}:${p.userId}`, p]));
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.ownerId!))] } },
    select: { id: true, email: true },
  });
  const emailOf = new Map(users.map((u) => [u.id, u.email]));

  const items = rows.map((r) => {
    const kind = r.dueAt! < now ? "overdue" : "due_soon";
    const p = pref.get(`${r.organizationId}:${r.ownerId}`);
    return {
      row: r,
      kind,
      wantsEmail: p?.email ?? true,
      data: {
        organizationId: r.organizationId,
        userId: r.ownerId!,
        type: `activity_${kind}`,
        title: kind === "overdue" ? `Terlambat: ${r.subject}` : `Segera jatuh tempo: ${r.subject}`,
        body: null,
        link: "/activities",
        dedupeKey: `activity:${r.id}:${kind}:${r.dueAt!.getTime()}`,
        // Preferensi in-app mati → tetap dicatat (untuk idempotensi) tetapi langsung dianggap dibaca.
        readAt: (p?.inApp ?? true) ? null : now,
      },
    };
  });

  const created = await prisma.notification.createManyAndReturn({
    data: items.map((i) => i.data),
    skipDuplicates: true,
    select: { dedupeKey: true },
  });
  const fresh = new Set(created.map((c) => c.dedupeKey));
  let emailed = 0;
  for (const i of items) {
    if (!fresh.has(i.data.dedupeKey) || !i.wantsEmail) continue;
    const to = emailOf.get(i.data.userId);
    if (!to) continue;
    await sendMail(
      {
        to,
        subject: i.data.title,
        text: `${i.data.title}\n\nBuka CRM untuk melihat daftar aktivitas Anda.`,
      },
      { organizationId: i.data.organizationId },
    ).catch((err) => logger.error({ err }, "Gagal mengantre email reminder"));
    emailed++;
  }
  logger.info({ created: created.length, emailed }, "Reminder dipindai");
  return { created: created.length, emailed };
}
