import { z } from "zod";
import { leadSchema } from "@/modules/leads/schemas";

/** Payload form website. Alias `company`/`message` diterima agar mudah dipasang di form apa pun. */
export const webhookPayloadSchema = z
  .object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    companyName: z.string().optional(),
    message: z.string().optional(),
    needs: z.string().optional(),
    budget: z.union([z.string(), z.number()]).optional(),
    notes: z.string().optional(),
  })
  .transform((v) => ({
    name: v.name,
    email: v.email,
    phone: v.phone,
    companyName: v.companyName ?? v.company,
    needs: v.needs ?? v.message,
    budget: v.budget,
    notes: v.notes,
  }));

const leadFields = leadSchema.pick({
  name: true,
  email: true,
  phone: true,
  companyName: true,
  needs: true,
  budget: true,
  notes: true,
});

/** Normalisasi alias lalu validasi dengan skema lead yang sama seperti form. */
export function parseWebhookPayload(json: unknown) {
  const alias = webhookPayloadSchema.safeParse(json);
  if (!alias.success) return alias;
  return leadFields.safeParse(alias.data);
}

export const rotateWebhookSchema = z.object({});
export const toggleWebhookSchema = z.object({ isActive: z.boolean() });
