import { z } from "zod";
import { currencySchema, optionalMoney } from "@/lib/money";
import { optionalEmail, optionalPhone, optionalText, optionalUuid } from "@/lib/schema-helpers";
import { LEAD_STATUSES, URGENCIES } from "@/modules/leads/constants";

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional());

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  email: optionalEmail,
  phone: optionalPhone,
  companyName: optionalText(160),
  needs: optionalText(2000),
  budget: optionalMoney,
  currency: currencySchema.default("IDR"),
  urgency: optionalEnum(URGENCIES),
  notes: optionalText(5000),
  sourceId: optionalUuid,
  ownerId: optionalUuid,
});
export type LeadInput = z.input<typeof leadSchema>;
export type LeadData = z.output<typeof leadSchema>;
export const updateLeadSchema = leadSchema.extend({ id: z.uuid() });

export const leadStatusSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(LEAD_STATUSES),
    reason: optionalText(500),
  })
  .refine((v) => v.status !== "unqualified" || (v.reason && v.reason.length >= 3), {
    path: ["reason"],
    message: "Alasan wajib diisi (min. 3 karakter) untuk status Unqualified",
  });

export const assignLeadSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid().nullable(),
});

export const leadSourceSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
});
export const renameLeadSourceSchema = leadSourceSchema.extend({ id: z.uuid() });
export const toggleLeadSourceSchema = z.object({ id: z.uuid(), isActive: z.boolean() });

// --- Konversi lead (plan 1.7) ---
const party = (key: string) =>
  z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("create") }),
    z.object({ mode: z.literal("link"), [key]: z.uuid() }),
    z.object({ mode: z.literal("none") }),
  ]);

export const convertLeadSchema = z.object({
  leadId: z.uuid(),
  contact: party("contactId"),
  company: party("companyId"),
  deal: z.object({
    create: z.boolean(),
    title: optionalText(160),
    value: optionalMoney,
    currency: currencySchema.optional(),
    stageId: optionalUuid,
    expectedCloseDate: optionalText(10),
  }),
});
export type ConvertLeadInput = z.input<typeof convertLeadSchema>;
export type ConvertLeadData = z.output<typeof convertLeadSchema>;
