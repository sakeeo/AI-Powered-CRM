"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import { feedbackSchema, feedbackStatusSchema } from "@/modules/feedback/schemas";

function revalidateParty(f: { contactId?: string | null; companyId?: string | null }) {
  revalidatePath("/feedback");
  if (f.companyId) revalidatePath(`/customers/company/${f.companyId}`);
  if (f.contactId) revalidatePath(`/customers/contact/${f.contactId}`);
}

export const createFeedback = tenantAction(feedbackSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Feedback");
  if (
    input.contactId &&
    !(await ctx.db.contact.findFirst({ where: { id: input.contactId, deletedAt: null } }))
  )
    throw new AppError("Contact tidak ditemukan");
  if (
    input.companyId &&
    !(await ctx.db.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))
  )
    throw new AppError("Company tidak ditemukan");
  if (
    input.dealId &&
    !(await ctx.db.deal.findFirst({ where: { id: input.dealId, deletedAt: null } }))
  )
    throw new AppError("Deal tidak ditemukan");
  const f = await ctx.db.feedback.create({
    data: { ...input, ownerId: ctx.userId, createdBy: ctx.userId } as never,
  });
  await writeAudit(ctx, {
    action: `${input.type}.created`,
    entityType: "Feedback",
    entityId: f.id,
    after: { subject: input.subject },
  });
  revalidateParty(input);
  return { id: f.id };
});

async function load(ctx: Parameters<Parameters<typeof tenantAction>[1]>[0], id: string) {
  const f = await ctx.db.feedback.findFirst({ where: { id } });
  if (!f) throw NotFoundError("Feedback");
  return f;
}

export const setFeedbackStatus = tenantAction(feedbackStatusSchema, async (ctx, { id, status }) => {
  const f = await load(ctx, id);
  assertCan(ctx, "update", "Feedback", f);
  await ctx.db.feedback.update({
    where: { id },
    data: { status, resolvedAt: status === "resolved" ? new Date() : null },
  });
  await writeAudit(ctx, {
    action: `${f.type}.${status}`,
    entityType: "Feedback",
    entityId: id,
    before: { status: f.status },
    after: { status },
  });
  revalidateParty(f);
});

export const deleteFeedback = tenantAction(idInput, async (ctx, { id }) => {
  const f = await load(ctx, id);
  assertCan(ctx, "delete", "Feedback", f);
  await ctx.db.feedback.delete({ where: { id } });
  await writeAudit(ctx, {
    action: `${f.type}.deleted`,
    entityType: "Feedback",
    entityId: id,
    before: { subject: f.subject },
  });
  revalidateParty(f);
});
