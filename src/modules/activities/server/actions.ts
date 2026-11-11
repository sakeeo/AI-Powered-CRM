"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan, scopeWhere } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import { sanitizeRichText } from "@/lib/sanitize";
import { zonedToUtc } from "@/lib/timezone";
import {
  createActivitySchema,
  setActivityStatusSchema,
  updateActivitySchema,
} from "@/modules/activities/schemas";
import { assertActiveMember, getOrganization } from "@/modules/organizations/server/queries";

const toDue = (local: string | undefined, tz: string) => (local ? zonedToUtc(local, tz) : null);

/** Pastikan record yang ditautkan ada di tenant ini DAN boleh dilihat pengguna (Sales Rep: hanya miliknya). */
async function assertLinks(
  ctx: ActionContext,
  l: { leadId?: string; contactId?: string; companyId?: string; dealId?: string },
) {
  const checks: [string | undefined, () => Promise<unknown>][] = [
    [
      l.leadId,
      () =>
        ctx.db.lead.findFirst({
          where: { AND: [{ id: l.leadId }, scopeWhere(ctx, "view", "Lead")] } as never,
        }),
    ],
    [
      l.contactId,
      () =>
        ctx.db.contact.findFirst({
          where: {
            AND: [{ id: l.contactId, deletedAt: null }, scopeWhere(ctx, "view", "Contact")],
          } as never,
        }),
    ],
    [
      l.companyId,
      () =>
        ctx.db.company.findFirst({
          where: {
            AND: [{ id: l.companyId, deletedAt: null }, scopeWhere(ctx, "view", "Company")],
          } as never,
        }),
    ],
    [
      l.dealId,
      () =>
        ctx.db.deal.findFirst({
          where: {
            AND: [{ id: l.dealId, deletedAt: null }, scopeWhere(ctx, "view", "Deal")],
          } as never,
        }),
    ],
  ];
  for (const [id, find] of checks)
    if (id && !(await find())) throw new AppError("Record terkait tidak ditemukan");
}

function revalidateLinks(a: {
  leadId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
}) {
  revalidatePath("/activities");
  if (a.leadId) revalidatePath(`/leads/${a.leadId}`);
  if (a.contactId) revalidatePath(`/contacts/${a.contactId}`);
  if (a.companyId) revalidatePath(`/companies/${a.companyId}`);
  if (a.dealId) revalidatePath(`/deals/${a.dealId}`);
}

/**
 * Buat task atau catat aktivitas. Task selalu terbuka. Call/meeting/email/note tanpa tenggat dicatat sebagai
 * sudah terjadi (selesai); dengan tenggat berarti dijadwalkan (terbuka).
 */
export const createActivity = tenantAction(createActivitySchema, async (ctx, input) => {
  assertCan(ctx, "create", "Activity");
  const { type, subject, body, dueLocal, ownerId: requested, ...links } = input;
  await assertLinks(ctx, links);
  const ownerId = ctx.role === "sales_rep" ? ctx.userId : (requested ?? ctx.userId);
  if (ownerId !== ctx.userId) await assertActiveMember(ctx, ownerId);
  const { timezone } = await getOrganization(ctx);
  const dueAt = toDue(dueLocal, timezone);
  const logged = type !== "task" && !dueAt;
  const a = await ctx.db.activity.create({
    data: {
      type,
      subject,
      body: body ? sanitizeRichText(body) : null,
      dueAt,
      status: logged ? "done" : "open",
      completedAt: logged ? new Date() : null,
      ownerId,
      ...links,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "activity.created",
    entityType: "Activity",
    entityId: a.id,
    after: { type, subject, ownerId, dueAt },
  });
  revalidateLinks(links);
  return { id: a.id };
});

async function load(ctx: ActionContext, id: string) {
  const a = await ctx.db.activity.findFirst({ where: { id } });
  if (!a) throw NotFoundError("Aktivitas");
  return a;
}

export const updateActivity = tenantAction(updateActivitySchema, async (ctx, input) => {
  const { id, subject, body, dueLocal, ownerId: requested } = input;
  const a = await load(ctx, id);
  assertCan(ctx, "update", "Activity", a);
  const ownerId = ctx.role === "sales_rep" ? a.ownerId : (requested ?? a.ownerId);
  if (ownerId && ownerId !== a.ownerId) await assertActiveMember(ctx, ownerId);
  const { timezone } = await getOrganization(ctx);
  await ctx.db.activity.update({
    where: { id },
    data: {
      subject,
      body: body ? sanitizeRichText(body) : null,
      dueAt: toDue(dueLocal, timezone),
      ownerId,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "activity.updated",
    entityType: "Activity",
    entityId: id,
    before: { subject: a.subject, ownerId: a.ownerId },
    after: { subject, ownerId },
  });
  revalidateLinks(a);
});

/** Selesai / batal / buka kembali. */
export const setActivityStatus = tenantAction(
  setActivityStatusSchema,
  async (ctx, { id, status }) => {
    const a = await load(ctx, id);
    assertCan(ctx, "update", "Activity", a);
    await ctx.db.activity.update({
      where: { id },
      data: { status, completedAt: status === "done" ? new Date() : null, updatedBy: ctx.userId },
    });
    await writeAudit(ctx, {
      action: `activity.${status === "open" ? "reopened" : status}`,
      entityType: "Activity",
      entityId: id,
      before: { status: a.status },
      after: { status },
    });
    revalidateLinks(a);
  },
);

export const deleteActivity = tenantAction(idInput, async (ctx, { id }) => {
  const a = await load(ctx, id);
  assertCan(ctx, "delete", "Activity", a);
  await ctx.db.activity.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "activity.deleted",
    entityType: "Activity",
    entityId: id,
    before: { subject: a.subject, type: a.type },
  });
  revalidateLinks(a);
});
