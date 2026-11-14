import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { forTenant } from "@/lib/tenant";
import { dateInTz, zonedToUtc } from "@/lib/timezone";

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
      organization: { deletedAt: null },
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

export const QUOTATION_EXPIRY_WARN_DAYS = 3;

/**
 * Quotation: (1) otomatis Expired bila masa berlaku lewat, (2) pengingat mendekati expiry → notifikasi
 * + task follow-up untuk pemilik. Idempoten lewat dedupeKey notifikasi (task hanya dibuat saat
 * notifikasinya baru dibuat). "Hari ini" mengikuti zona waktu organisasi.
 */
export async function scanQuotations(now = new Date()) {
  const rows = await prisma.quotation.findMany({
    where: { status: "sent", deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      number: true,
      ownerId: true,
      validUntil: true,
      dealId: true,
      contactId: true,
      companyId: true,
      organization: { select: { timezone: true } },
    },
    take: 1000,
  });
  let expired = 0;
  let reminded = 0;
  for (const q of rows) {
    const tz = q.organization.timezone;
    const today = dateInTz(now, tz);
    const until = q.validUntil.toISOString().slice(0, 10);
    if (until < today) {
      const res = await prisma.quotation.updateMany({
        where: { id: q.id, organizationId: q.organizationId, status: "sent" },
        data: { status: "expired" },
      });
      if (res.count) {
        expired++;
        await writeAudit(
          { db: forTenant(prisma, q.organizationId), userId: null },
          {
            action: "quotation.expired",
            entityType: "Quotation",
            entityId: q.id,
            before: { status: "sent" },
            after: { status: "expired" },
          },
        );
      }
      continue;
    }
    const daysLeft = Math.round((Date.parse(until) - Date.parse(today)) / 86_400_000);
    if (daysLeft > QUOTATION_EXPIRY_WARN_DAYS || !q.ownerId) continue;
    const made = await prisma.notification.createManyAndReturn({
      data: [
        {
          organizationId: q.organizationId,
          userId: q.ownerId,
          type: "quotation_expiring",
          title: `Quotation ${q.number} berakhir ${daysLeft === 0 ? "hari ini" : `${daysLeft} hari lagi`}`,
          link: `/quotations/${q.id}`,
          dedupeKey: `quotation:${q.id}:expiring:${until}`,
        },
      ],
      skipDuplicates: true,
      select: { id: true },
    });
    if (!made.length) continue;
    reminded++;
    await prisma.activity.create({
      data: {
        organizationId: q.organizationId,
        type: "task",
        subject: `Follow up quotation ${q.number} (berakhir ${until})`,
        status: "open",
        dueAt: zonedToUtc(until, tz),
        ownerId: q.ownerId,
        dealId: q.dealId,
        contactId: q.contactId,
        companyId: q.companyId,
      },
    });
  }
  if (expired || reminded) logger.info({ expired, reminded }, "Quotation dipindai");
  return { expired, reminded };
}
