"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import { APPROVER_ROLES, canDecide, requiresApproval } from "@/modules/quotations/approval";
import { getQuotationSettings } from "@/modules/quotations/server/settings";

async function load(ctx: ActionContext, id: string) {
  const q = await ctx.db.quotation.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw NotFoundError("Quotation");
  return q;
}

/** Ajukan persetujuan (hanya Draft dengan item & total yang memang memerlukan approval). Isi dikunci selama pending. */
export const requestQuotationApproval = tenantAction(idInput, async (ctx, { id }) => {
  const q = await load(ctx, id);
  assertCan(ctx, "update", "Quotation", q);
  if (q.status !== "draft") throw new AppError("Hanya quotation Draft yang dapat diajukan");
  if (q.approvalStatus === "pending") throw new AppError("Pengajuan sudah menunggu persetujuan");
  const items = await ctx.db.quotationItem.count({ where: { quotationId: id } });
  if (!items) throw new AppError("Tambahkan item sebelum mengajukan persetujuan");
  const { approvalThreshold } = await getQuotationSettings(ctx.db);
  if (!requiresApproval(q.total.toFixed(2), approvalThreshold))
    throw new AppError("Quotation ini tidak memerlukan persetujuan");
  const now = new Date();
  await ctx.db.quotation.update({
    where: { id },
    data: {
      approvalStatus: "pending",
      approvalRequestedBy: ctx.userId,
      approvalRequestedAt: now,
      approvedBy: null,
      approvedAt: null,
      approvalNote: null,
    },
  });
  const approvers = await ctx.db.member.findMany({
    where: { active: true, role: { in: [...APPROVER_ROLES] }, userId: { not: ctx.userId } },
    select: { userId: true },
  });
  if (approvers.length)
    await ctx.db.notification.createMany({
      data: approvers.map((a) => ({
        userId: a.userId,
        type: "quotation_approval",
        title: `Persetujuan diperlukan: ${q.number}`,
        body: q.title,
        link: `/quotations/${id}`,
        dedupeKey: `quo-approval:${id}:${now.getTime()}`,
      })) as never,
      skipDuplicates: true,
    });
  await writeAudit(ctx, {
    action: "quotation.approval_requested",
    entityType: "Quotation",
    entityId: id,
    after: { total: q.total.toFixed(2) },
  });
  revalidatePath(`/quotations/${id}`);
});

/** Tarik pengajuan (peminta atau approver) agar isi dapat diubah lagi. */
export const cancelQuotationApproval = tenantAction(idInput, async (ctx, { id }) => {
  const q = await load(ctx, id);
  if (q.approvalStatus !== "pending") throw new AppError("Tidak ada pengajuan yang menunggu");
  const isRequester = q.approvalRequestedBy === ctx.userId;
  if (!isRequester && !(APPROVER_ROLES as readonly string[]).includes(ctx.role))
    throw ForbiddenError();
  await ctx.db.quotation.update({
    where: { id },
    data: { approvalStatus: "none", approvalRequestedBy: null, approvalRequestedAt: null },
  });
  await writeAudit(ctx, {
    action: "quotation.approval_cancelled",
    entityType: "Quotation",
    entityId: id,
  });
  revalidatePath(`/quotations/${id}`);
});

const decisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

/** Putuskan pengajuan. Menolak wajib beralasan; Sales Manager tidak dapat menyetujui pengajuannya sendiri. */
export const decideQuotationApproval = tenantAction(
  decisionSchema,
  async (ctx, { id, decision, note }) => {
    const q = await load(ctx, id);
    if (q.approvalStatus !== "pending") throw new AppError("Tidak ada pengajuan yang menunggu");
    if (!canDecide({ role: ctx.role, userId: ctx.userId, requestedBy: q.approvalRequestedBy }))
      throw new AppError("Anda tidak berwenang memutuskan pengajuan ini", 403, "forbidden");
    if (decision === "rejected" && (!note || note.length < 3))
      throw new AppError("Alasan penolakan wajib diisi (min. 3 karakter)");
    const now = new Date();
    await ctx.db.quotation.update({
      where: { id },
      data: {
        approvalStatus: decision,
        approvedBy: ctx.userId,
        approvedAt: now,
        approvalNote: note ?? null,
      },
    });
    if (q.approvalRequestedBy)
      await ctx.db.notification.createMany({
        data: [
          {
            userId: q.approvalRequestedBy,
            type: "quotation_approval_result",
            title: `${q.number} ${decision === "approved" ? "disetujui" : "ditolak"}`,
            body: note ?? null,
            link: `/quotations/${id}`,
            dedupeKey: `quo-approval-result:${id}:${now.getTime()}`,
          },
        ] as never,
        skipDuplicates: true,
      });
    await writeAudit(ctx, {
      action: `quotation.approval_${decision}`,
      entityType: "Quotation",
      entityId: id,
      after: { note },
    });
    revalidatePath(`/quotations/${id}`);
  },
);
