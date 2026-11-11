import nodemailer from "nodemailer";
import { Resend } from "resend";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};
export type ResendConfig = { apiKey: string; from: string };
export type EmailConfig =
  { type: "email_smtp"; config: SmtpConfig } | { type: "email_resend"; config: ResendConfig };
export type OutgoingMail = { to: string; subject: string; text: string };

/** Kirim satu email melalui connector tenant. Melempar error bila penyedia menolak (dipakai retry BullMQ). */
export async function sendViaConnector(email: EmailConfig, mail: OutgoingMail): Promise<void> {
  if (email.type === "email_smtp") {
    const c = email.config;
    const transport = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: c.user ? { user: c.user, pass: c.pass } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transport.sendMail({ from: c.from, to: mail.to, subject: mail.subject, text: mail.text });
    return;
  }
  const { error } = await new Resend(email.config.apiKey).emails.send({
    from: email.config.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
  if (error) throw new Error(error.message);
}
