import { z } from "zod";
import { optionalUuid } from "@/lib/schema-helpers";
import { ACTIVITY_STATUSES, ACTIVITY_TYPES } from "@/modules/activities/constants";

const dueLocal = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Format tanggal tidak valid")
    .optional(),
);

const base = {
  subject: z.string().trim().min(2, "Judul minimal 2 karakter").max(160),
  body: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().max(20000, "Isi terlalu panjang").optional(),
  ),
  dueLocal,
  ownerId: optionalUuid,
};

export const createActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  ...base,
  leadId: optionalUuid,
  contactId: optionalUuid,
  companyId: optionalUuid,
  dealId: optionalUuid,
});
export type CreateActivityInput = z.input<typeof createActivitySchema>;

export const updateActivitySchema = z.object({ id: z.uuid(), ...base });
export const setActivityStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(ACTIVITY_STATUSES),
});
