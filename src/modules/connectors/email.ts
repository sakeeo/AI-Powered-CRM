import { z } from "zod";

export const EMAIL_PROVIDERS = ["smtp", "resend"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];
export const EMAIL_PROVIDER_INFO: Record<
  EmailProvider,
  { type: `email_${EmailProvider}`; title: string; description: string }
> = {
  smtp: {
    type: "email_smtp",
    title: "SMTP kustom",
    description: "Server SMTP Anda sendiri (Gmail, Mailgun, Postfix, dll.).",
  },
  resend: {
    type: "email_resend",
    title: "Resend",
    description: "Kirim lewat Resend dengan API key dan domain terverifikasi.",
  },
};

const from = z.string().trim().min(5, "Alamat pengirim wajib diisi").max(200);

/** Rahasia (password/API key) opsional saat mengubah — kosong berarti pertahankan yang tersimpan. */
export const saveEmailConnectorSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("smtp"),
    host: z.string().trim().min(2, "Host wajib diisi").max(200),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().trim().max(200).optional(),
    pass: z.string().max(500).optional(),
    from,
  }),
  z.object({
    provider: z.literal("resend"),
    apiKey: z.string().trim().max(500).optional(),
    from,
  }),
]);
export const emailProviderSchema = z.object({ provider: z.enum(EMAIL_PROVIDERS) });
