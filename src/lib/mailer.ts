import { decryptSecret } from "@/lib/crypto";
import { sendViaConnector, type EmailConfig, type OutgoingMail } from "@/lib/email-transport";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getQueue, QUEUES } from "@/lib/queue";

export type Mail = OutgoingMail;
export type MailJob = { organizationId: string; connectorId: string; mail: OutgoingMail };

export const MAIL_ATTEMPTS = 5;

/** Organisasi pengirim: dari konteks, atau organisasi aktif pertama milik penerima (mis. reset password). */
async function resolveOrganization(mail: Mail, organizationId?: string) {
  if (organizationId) return organizationId;
  const m = await prisma.member.findFirst({
    where: { user: { email: mail.to }, active: true, organization: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return m?.organizationId ?? null;
}

/**
 * Email transaksional lewat connector Email Delivery milik organisasi (SMTP/Resend).
 * Dengan connector: dimasukkan ke antrean BullMQ (retry exponential backoff oleh worker); bila Redis
 * tidak tersedia dikirim langsung sekali. Tanpa connector: development → dicatat ke log; production →
 * tidak terkirim dan isi (yang memuat token) tidak dicatat.
 */
export async function sendMail(
  mail: Mail,
  opts: { organizationId?: string; backoffMs?: number } = {},
): Promise<void> {
  const organizationId = await resolveOrganization(mail, opts.organizationId);
  const connector = organizationId
    ? await prisma.tenantConnector.findFirst({
        where: { organizationId, type: { startsWith: "email_" }, status: { not: "disabled" } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true },
      })
    : null;

  if (!connector || !organizationId) {
    if (env.NODE_ENV === "production") {
      logger.warn(
        { to: mail.to, subject: mail.subject },
        "Email tidak terkirim: connector email belum dikonfigurasi",
      );
      return;
    }
    logger.info(
      { to: mail.to, subject: mail.subject, text: mail.text },
      "[dev-mail] email transaksional",
    );
    return;
  }

  const job: MailJob = { organizationId, connectorId: connector.id, mail };
  try {
    await getQueue(QUEUES.mail).add("send", job, {
      attempts: MAIL_ATTEMPTS,
      backoff: { type: "exponential", delay: opts.backoffMs ?? 5_000 },
      removeOnComplete: true,
      removeOnFail: { age: 86_400 },
    });
  } catch (err) {
    logger.error({ err }, "Antrean email tidak tersedia; mengirim langsung");
    await deliverMail(job);
  }
}

/** Dipanggil worker (dan fallback inline): kirim email melalui connector. Error → retry oleh BullMQ. */
export async function deliverMail(job: MailJob): Promise<void> {
  const row = await prisma.tenantConnector.findFirst({
    where: { id: job.connectorId, organizationId: job.organizationId },
  });
  if (!row) throw new Error("Connector email tidak ditemukan");
  const config = JSON.parse(
    decryptSecret(row.configEncrypted, `${job.organizationId}:${row.type}`),
  ) as EmailConfig["config"];
  await sendViaConnector({ type: row.type, config } as EmailConfig, job.mail);
  logger.info({ to: job.mail.to, subject: job.mail.subject, type: row.type }, "Email terkirim");
}
