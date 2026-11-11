import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type Mail = { to: string; subject: string; text: string };

/**
 * Pengiriman email transaksional.
 * - development/test: isi email dicatat ke log (tautan reset bisa disalin dari terminal).
 * - production: menunggu connector email (plan 1.13). Sampai itu ada, email TIDAK dikirim
 *   dan isinya (yang memuat token) tidak dicatat.
 */
export async function sendMail(mail: Mail): Promise<void> {
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
}
