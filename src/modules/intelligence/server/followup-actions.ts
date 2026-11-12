"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { followUpSubject } from "@/modules/intelligence/schemas";
import { FOLLOWUP_CHANNEL_LABEL } from "@/modules/intelligence/followup";
import { getFollowUpRecommendation } from "@/modules/intelligence/server/followup";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (t: string) =>
  t
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/**
 * Terima rekomendasi → buat TASK follow-up (aksi eksplisit pengguna). Rekomendasi dihitung ulang di server
 * (isi dari klien tidak dipercaya). Tidak ada pengiriman pesan. Tidak ganda bila task identik masih terbuka.
 */
export const acceptFollowUpRecommendation = tenantAction(followUpSubject, async (ctx, s) => {
  assertCan(ctx, "create", "Activity");
  const rec = await getFollowUpRecommendation(ctx, s);
  const subject = rec.draft.subject.slice(0, 160);
  const link =
    s.type === "lead"
      ? { leadId: s.id }
      : s.type === "company"
        ? { companyId: s.id }
        : { contactId: s.id };
  const exists = await ctx.db.activity.findFirst({
    where: { ...link, type: "task", status: "open", subject },
    select: { id: true },
  });
  if (exists) throw new AppError("Sudah ada task follow-up yang sama dan masih terbuka");
  const a = await ctx.db.activity.create({
    data: {
      type: "task",
      subject,
      body: toHtml(
        `${rec.channel ? `Kanal disarankan: ${FOLLOWUP_CHANNEL_LABEL[rec.channel]}\n\n` : ""}${rec.draft.body}`,
      ),
      status: "open",
      dueAt: rec.suggestedAt,
      ownerId: ctx.userId,
      createdBy: ctx.userId,
      ...link,
    } as never,
  });
  await ctx.db.recommendationFeedback.create({
    data: {
      userId: ctx.userId,
      kind: "followup",
      subjectType: s.type,
      subjectId: s.id,
      decision: "accepted",
      channel: rec.channel,
    } as never,
  });
  await writeAudit(ctx, {
    action: "followup.recommendation_accepted",
    entityType: s.type === "lead" ? "Lead" : s.type === "company" ? "Company" : "Contact",
    entityId: s.id,
    after: { activityId: a.id },
  });
  revalidatePath("/activities");
  return { id: a.id };
});

/** Tolak rekomendasi — hanya mencatat umpan balik (tidak mengubah data bisnis). */
export const rejectFollowUpRecommendation = tenantAction(followUpSubject, async (ctx, s) => {
  const rec = await getFollowUpRecommendation(ctx, s);
  await ctx.db.recommendationFeedback.create({
    data: {
      userId: ctx.userId,
      kind: "followup",
      subjectType: s.type,
      subjectId: s.id,
      decision: "rejected",
      channel: rec.channel,
    } as never,
  });
  return {};
});
