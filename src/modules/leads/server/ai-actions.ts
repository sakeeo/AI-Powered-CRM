"use server";

import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { assertCan } from "@/lib/authz";
import { runAi } from "@/lib/ai";
import { extractLeadDraft, MAX_TEXT_LENGTH } from "@/modules/leads/server/text-to-lead";

const textToLeadSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Tempel teks minimal 10 karakter")
    .max(MAX_TEXT_LENGTH, `Maksimal ${MAX_TEXT_LENGTH} karakter`),
});

/**
 * Safe AI Text-to-Lead: HANYA mengembalikan draf. Tidak ada penulisan ke tabel bisnis di sini;
 * hanya metadata pemanggilan AI yang dicatat oleh runAi.
 */
export const draftLeadFromText = tenantAction(textToLeadSchema, async (ctx, { text }) => {
  assertCan(ctx, "create", "Lead");
  return runAi(ctx, "lead_text_to_lead", ({ model }) => extractLeadDraft(model, text));
});
