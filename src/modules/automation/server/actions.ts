"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import {
  ruleSchema,
  toggleRuleSchema,
  updateRuleSchema,
  type AutomationAction,
} from "@/modules/automation/schemas";
import { assertActiveMember } from "@/modules/organizations/server/queries";

/** Semua pengguna yang dirujuk aksi harus anggota aktif organisasi ini (batas permission rule). */
async function assertRecipients(ctx: ActionContext, actions: AutomationAction[]) {
  const ids = new Set<string>();
  for (const a of actions) {
    if (a.type === "assign_owner") a.userIds.forEach((u) => ids.add(u));
    if (a.type === "create_task" && a.assignTo !== "owner") ids.add(a.assignTo);
    if (a.type === "send_notification" && a.to !== "owner") ids.add(a.to);
  }
  for (const id of ids) await assertActiveMember(ctx, id);
}

export const createRule = tenantAction(ruleSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Automation");
  await assertRecipients(ctx, input.actions);
  const rule = await ctx.db.automationRule.create({
    data: { ...input, createdBy: ctx.userId } as never,
  });
  await writeAudit(ctx, {
    action: "automation.rule_created",
    entityType: "Automation",
    entityId: rule.id,
    after: { name: input.name, trigger: input.trigger, actions: input.actions.map((a) => a.type) },
  });
  revalidatePath("/settings/automation");
  return { id: rule.id };
});

export const updateRule = tenantAction(updateRuleSchema, async (ctx, { id, ...input }) => {
  assertCan(ctx, "update", "Automation");
  const existing = await ctx.db.automationRule.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Rule");
  await assertRecipients(ctx, input.actions);
  await ctx.db.automationRule.update({
    where: { id },
    data: { ...input, updatedBy: ctx.userId } as never,
  });
  await writeAudit(ctx, {
    action: "automation.rule_updated",
    entityType: "Automation",
    entityId: id,
    before: { name: existing.name, trigger: existing.trigger, isActive: existing.isActive },
    after: { name: input.name, trigger: input.trigger, isActive: input.isActive },
  });
  revalidatePath("/settings/automation");
});

export const toggleRule = tenantAction(toggleRuleSchema, async (ctx, { id, isActive }) => {
  assertCan(ctx, "update", "Automation");
  const existing = await ctx.db.automationRule.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Rule");
  await ctx.db.automationRule.update({ where: { id }, data: { isActive, updatedBy: ctx.userId } });
  await writeAudit(ctx, {
    action: isActive ? "automation.rule_enabled" : "automation.rule_disabled",
    entityType: "Automation",
    entityId: id,
    after: { name: existing.name },
  });
  revalidatePath("/settings/automation");
});

export const deleteRule = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "delete", "Automation");
  const existing = await ctx.db.automationRule.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Rule");
  await ctx.db.automationRule.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "automation.rule_deleted",
    entityType: "Automation",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/settings/automation");
});
