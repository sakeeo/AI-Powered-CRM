import { getMemberContext } from "@/lib/context";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { dateInTz, zonedToUtc } from "@/lib/timezone";
import { planSchema } from "@/modules/insights/plan";
import { executePlan, type InsightResult } from "@/modules/insights/server/execute";

export type Schedule = {
  frequency: string;
  weekday: number | null;
  monthday: number | null;
  hour: number;
};

/**
 * Waktu eksekusi berikutnya (UTC) setelah `now`, mengikuti zona waktu organisasi.
 * weekday: 1=Senin…7=Minggu; monthday: 1–28 (menghindari bulan pendek).
 */
export function computeNextRun(s: Schedule, now: Date, tz: string): Date | null {
  if (!["daily", "weekly", "monthly"].includes(s.frequency)) return null;
  const hh = String(s.hour).padStart(2, "0");
  const [y, m, d] = dateInTz(now, tz).split("-").map(Number);
  for (let i = 0; i < 70; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const dow = ((day.getUTCDay() + 6) % 7) + 1;
    const ok =
      s.frequency === "daily" ||
      (s.frequency === "weekly" && dow === (s.weekday ?? 1)) ||
      (s.frequency === "monthly" && day.getUTCDate() === (s.monthday ?? 1));
    if (!ok) continue;
    const local = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}T${hh}:00`;
    const at = zonedToUtc(local, tz);
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
}

function emailText(name: string, r: InsightResult) {
  const rows = r.rows.slice(0, 30).map((row) => row.join("\t"));
  return [
    `Laporan terjadwal: ${name}`,
    "",
    r.title,
    r.summary,
    "",
    r.columns.join("\t"),
    ...rows,
    ...(r.rows.length > 30 ? [`… dan ${r.rows.length - 30} baris lain (lihat di CRM)`] : []),
    "",
    `Buka di CRM: ${env.BETTER_AUTH_URL}/reports/builder`,
  ].join("\n");
}

/**
 * Kirim laporan terjadwal yang jatuh tempo. Aman dijalankan paralel/berulang: jadwal "diklaim" lewat
 * UPDATE bersyarat atas `nextRunAt` (hanya satu pemanggil yang menang), sehingga tidak ada email ganda.
 * Setiap penerima menerima hasil yang dihitung dengan IZIN MILIKNYA sendiri (bukan izin pembuat laporan),
 * jadi penjadwalan tidak dapat dipakai untuk membuka data yang tak boleh dilihat penerima.
 */
export async function runDueReportSchedules(now = new Date()) {
  const due = await prisma.savedReport.findMany({
    where: { frequency: { not: "none" }, nextRunAt: { lte: now } },
    include: { organization: { select: { timezone: true, deletedAt: true } } },
    orderBy: { nextRunAt: "asc" },
    take: 50,
  });
  let reports = 0;
  let emails = 0;
  for (const r of due) {
    const tz = r.organization.timezone;
    const next = computeNextRun(r, now, tz);
    const claim = await prisma.savedReport.updateMany({
      where: { id: r.id, nextRunAt: r.nextRunAt },
      data: { nextRunAt: next, lastRunAt: now },
    });
    if (claim.count !== 1) continue;
    reports++;
    if (r.organization.deletedAt) continue;
    const plan = planSchema.safeParse(r.definition);
    const recipients = Array.isArray(r.recipientIds) ? (r.recipientIds as string[]) : [];
    let sent = 0;
    let skipped = 0;
    if (plan.success) {
      for (const userId of recipients) {
        try {
          const ctx = await getMemberContext(r.organizationId, userId);
          if (!ctx || !ctx.ability.can("view", "Report")) {
            skipped++;
            continue;
          }
          const result = await executePlan(ctx, plan.data, tz, now);
          await sendMail(
            {
              to: ctx.user.email,
              subject: `[CRM] Laporan: ${r.name}`,
              text: emailText(r.name, result),
            },
            { organizationId: r.organizationId },
          );
          sent++;
        } catch (err) {
          skipped++;
          logger.warn({ err, reportId: r.id }, "Laporan terjadwal dilewati untuk satu penerima");
        }
      }
    }
    await prisma.savedReport.update({
      where: { id: r.id },
      data: {
        lastStatus: plan.success ? `Terkirim ${sent}, dilewati ${skipped}` : "Definisi tidak valid",
      },
    });
    emails += sent;
  }
  return { reports, emails };
}
