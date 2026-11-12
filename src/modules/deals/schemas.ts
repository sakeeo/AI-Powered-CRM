import { z } from "zod";
import { currencySchema, optionalMoney } from "@/lib/money";
import { optionalText, optionalUuid } from "@/lib/schema-helpers";
import { customizationFields } from "@/modules/customization/schemas";
import { LOST_CATEGORIES } from "@/modules/reports/constants";

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD")
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Tanggal tidak valid")
    .optional(),
);

const optionalProbability = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int("Bilangan bulat").min(0).max(100).optional(),
);

const dealBase = z.object({
  title: z.string().trim().min(2, "Judul minimal 2 karakter").max(160),
  contactId: optionalUuid,
  companyId: optionalUuid,
  pipelineId: optionalUuid,
  stageId: optionalUuid,
  ownerId: optionalUuid,
  value: optionalMoney,
  currency: currencySchema.default("IDR"),
  expectedCloseDate: optionalDate,
  probability: optionalProbability,
  notes: optionalText(5000),
  ...customizationFields,
});

const needsParty = (v: { contactId?: string; companyId?: string }) =>
  !!(v.contactId || v.companyId);
const partyMsg = { path: ["contactId"], message: "Pilih contact atau company untuk deal ini" };

export const dealSchema = dealBase.refine(needsParty, partyMsg);
export type DealInput = z.input<typeof dealSchema>;
export type DealData = z.output<typeof dealSchema>;
export const updateDealSchema = dealBase.extend({ id: z.uuid() }).refine(needsParty, partyMsg);

export const moveStageSchema = z.object({ id: z.uuid(), stageId: z.uuid() });

export const stageSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
  probability: z.coerce.number().int().min(0).max(100),
});
export const updateStageSchema = stageSchema.extend({ id: z.uuid() });
export const reorderStageSchema = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) });
export const renamePipelineSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(60),
});

export const closeWonSchema = z.object({ id: z.uuid() });
export const closeLostSchema = z.object({
  id: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Alasan kalah wajib diisi (min. 3 karakter)")
    .max(500, "Maksimal 500 karakter"),
  /** Opsional; dipilih/dikonfirmasi user (AI hanya mengusulkan). */
  category: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.enum(LOST_CATEGORIES).optional(),
  ),
});
export const setLostCategorySchema = z.object({ id: z.uuid(), category: z.enum(LOST_CATEGORIES) });
