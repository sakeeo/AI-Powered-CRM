"use server";

import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { runAi } from "@/lib/ai";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { executePlan } from "@/modules/insights/server/execute";
import { PlanRejectedError, questionToPlan } from "@/modules/insights/server/plan-ai";
import { getOrganization } from "@/modules/organizations/server/queries";

const schema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Tulis pertanyaan minimal 5 karakter")
    .max(300, "Maksimal 300 karakter"),
});

/**
 * Tanya CRM dengan bahasa natural. Alur aman: LLM → rencana terbatas (whitelist) → eksekusi read-only
 * dengan scope tenant + izin pengguna → jawaban disusun KODE dari hasil database. LLM tidak pernah
 * menerima data hasil, tidak menulis data apa pun, dan pertanyaan tidak disimpan (hanya metadata AI).
 */
export const aiAskCrm = tenantAction(schema, async (ctx, { question }) => {
  const rl = await rateLimit(`insights:${ctx.organizationId}:${ctx.userId}`, 20, 60);
  if (!rl.allowed)
    throw new AppError("Terlalu banyak pertanyaan. Coba lagi sebentar.", 429, "rate_limited");
  let plan;
  try {
    plan = await runAi(ctx, "crm_insights", ({ model }) => questionToPlan(model, question));
  } catch (e) {
    // runAi membungkus semua galat; pesan penolakan rencana tetap disampaikan apa adanya.
    if (e instanceof PlanRejectedError) throw new AppError(e.message);
    throw e;
  }
  const { timezone } = await getOrganization(ctx);
  const result = await executePlan(ctx, plan, timezone);
  return { plan, result };
});
