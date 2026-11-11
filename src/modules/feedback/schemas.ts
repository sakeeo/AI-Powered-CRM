import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/schema-helpers";

export const FEEDBACK_TYPES = ["feedback", "complaint"] as const;
export const FEEDBACK_TYPE_LABEL = { feedback: "Feedback", complaint: "Complaint" } as const;
export const FEEDBACK_SORTS = ["createdAt", "subject"] as const;

export const feedbackSchema = z
  .object({
    type: z.enum(FEEDBACK_TYPES),
    subject: z.string().trim().min(3, "Judul minimal 3 karakter").max(160),
    body: optionalText(5000),
    contactId: optionalUuid,
    companyId: optionalUuid,
    dealId: optionalUuid,
  })
  .refine((v) => v.contactId || v.companyId, {
    path: ["contactId"],
    message: "Pilih contact atau company",
  });
export type FeedbackInput = z.input<typeof feedbackSchema>;
export const feedbackStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["open", "resolved"]),
});
