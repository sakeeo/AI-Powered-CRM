"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import { sanitizeRichText } from "@/lib/sanitize";
import { ACTIVITY_TYPES } from "@/modules/activities/constants";

const MANAGERS = ["owner", "admin", "sales_manager"];
const assertManage = (ctx: ActionContext) => {
  if (!MANAGERS.includes(ctx.role)) throw ForbiddenError();
};

const base = {
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(80),
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(2, "Judul minimal 2 karakter").max(160),
  body: z.string().max(20000).optional(),
  dueInDays: z.number().int().min(0).max(365).nullable().default(null),
  isActive: z.boolean().default(true),
};
const createSchema = z.object(base);
const updateSchema = z.object({ id: z.uuid(), ...base });

async function assertNameFree(ctx: ActionContext, name: string, exceptId?: string) {
  const dup = await ctx.db.activityTemplate.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw new AppError("Nama template sudah dipakai");
}

export const createActivityTemplate = tenantAction(createSchema, async (ctx, input) => {
  assertManage(ctx);
  await assertNameFree(ctx, input.name);
  const row = await ctx.db.activityTemplate.create({
    data: {
      ...input,
      body: input.body ? sanitizeRichText(input.body) : null,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "activity_template.created",
    entityType: "ActivityTemplate",
    entityId: row.id,
    after: { name: input.name, type: input.type },
  });
  revalidatePath("/settings/activity-templates");
  return { id: row.id };
});

export const updateActivityTemplate = tenantAction(updateSchema, async (ctx, { id, ...input }) => {
  assertManage(ctx);
  const existing = await ctx.db.activityTemplate.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Template");
  await assertNameFree(ctx, input.name, id);
  await ctx.db.activityTemplate.update({
    where: { id },
    data: {
      ...input,
      body: input.body ? sanitizeRichText(input.body) : null,
      updatedBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "activity_template.updated",
    entityType: "ActivityTemplate",
    entityId: id,
    before: { name: existing.name },
    after: { name: input.name, isActive: input.isActive },
  });
  revalidatePath("/settings/activity-templates");
});

export const deleteActivityTemplate = tenantAction(idInput, async (ctx, { id }) => {
  assertManage(ctx);
  const existing = await ctx.db.activityTemplate.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Template");
  await ctx.db.activityTemplate.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "activity_template.deleted",
    entityType: "ActivityTemplate",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/settings/activity-templates");
});
