"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { toDecimal } from "@/lib/money-db";
import { normalizePhone } from "@/lib/phone";
import { idInput } from "@/lib/schema-helpers";
import {
  assignLeadSchema,
  convertLeadSchema,
  leadSchema,
  leadSourceSchema,
  leadStatusSchema,
  renameLeadSourceSchema,
  toggleLeadSourceSchema,
  updateLeadSchema,
} from "@/modules/leads/schemas";
import { convertLeadService } from "@/modules/leads/server/conversion";
import { assertActiveMember } from "@/modules/organizations/server/queries";

async function assertSource(ctx: ActionContext, sourceId?: string) {
  if (!sourceId) return;
  const s = await ctx.db.leadSource.findFirst({ where: { id: sourceId, isActive: true } });
  if (!s) throw new AppError("Sumber lead tidak valid");
}

/** Lead baru: Sales Rep otomatis menjadi owner; peran lain boleh membiarkan lead belum ditugaskan. */
export const createLead = tenantAction(leadSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Lead");
  const { budget, ownerId: requested, ...data } = input;
  const ownerId = ctx.role === "sales_rep" ? ctx.userId : (requested ?? null);
  if (ownerId && ownerId !== ctx.userId) await assertActiveMember(ctx, ownerId);
  await assertSource(ctx, data.sourceId);
  const lead = await ctx.db.lead.create({
    data: {
      ...data,
      phoneNormalized: normalizePhone(data.phone),
      budget: toDecimal(budget),
      ownerId,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "lead.created",
    entityType: "Lead",
    entityId: lead.id,
    after: { name: lead.name, ownerId },
  });
  revalidatePath("/leads");
  return { id: lead.id };
});

export const updateLead = tenantAction(updateLeadSchema, async (ctx, input) => {
  const { id, budget, ownerId: requested, ...data } = input;
  const existing = await ctx.db.lead.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Lead");
  assertCan(ctx, "update", "Lead", existing);
  if (existing.archivedAt) throw new AppError("Lead terarsip. Pulihkan dulu untuk mengubahnya.");
  const ownerId = ctx.role === "sales_rep" ? existing.ownerId : (requested ?? existing.ownerId);
  if (ownerId && ownerId !== existing.ownerId) await assertActiveMember(ctx, ownerId);
  await assertSource(ctx, data.sourceId);
  await ctx.db.lead.update({
    where: { id },
    data: {
      ...data,
      phoneNormalized: normalizePhone(data.phone),
      budget: toDecimal(budget),
      ownerId,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "lead.updated",
    entityType: "Lead",
    entityId: id,
    before: { name: existing.name, ownerId: existing.ownerId },
    after: { name: data.name, ownerId },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
});

/** Alur kualifikasi: ubah status; Unqualified wajib beserta alasan. */
export const setLeadStatus = tenantAction(leadStatusSchema, async (ctx, { id, status, reason }) => {
  const existing = await ctx.db.lead.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Lead");
  assertCan(ctx, "update", "Lead", existing);
  if (existing.archivedAt) throw new AppError("Lead terarsip");
  await ctx.db.lead.update({
    where: { id },
    data: {
      status,
      unqualifiedReason: status === "unqualified" ? reason : null,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "lead.status_changed",
    entityType: "Lead",
    entityId: id,
    before: { status: existing.status },
    after: { status, reason: status === "unqualified" ? reason : undefined },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
});

/** Assignment/penugasan ulang. Sales Rep tidak boleh melepas lead ke orang lain. */
export const assignLead = tenantAction(assignLeadSchema, async (ctx, { id, ownerId }) => {
  const existing = await ctx.db.lead.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Lead");
  assertCan(ctx, "update", "Lead", existing);
  if (ctx.role === "sales_rep") throw new AppError("Akses ditolak", 403, "forbidden");
  if (ownerId) await assertActiveMember(ctx, ownerId);
  await ctx.db.lead.update({ where: { id }, data: { ownerId, updatedBy: ctx.userId } });
  await writeAudit(ctx, {
    action: "lead.assigned",
    entityType: "Lead",
    entityId: id,
    before: { ownerId: existing.ownerId },
    after: { ownerId },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
});

export const archiveLead = tenantAction(idInput, async (ctx, { id }) => {
  const existing = await ctx.db.lead.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Lead");
  assertCan(ctx, "delete", "Lead", existing);
  await ctx.db.lead.update({
    where: { id },
    data: { archivedAt: new Date(), updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: "lead.archived",
    entityType: "Lead",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
});

export const restoreLead = tenantAction(idInput, async (ctx, { id }) => {
  const existing = await ctx.db.lead.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Lead");
  assertCan(ctx, "delete", "Lead", existing);
  await ctx.db.lead.update({ where: { id }, data: { archivedAt: null, updatedBy: ctx.userId } });
  await writeAudit(ctx, { action: "lead.restored", entityType: "Lead", entityId: id });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
});

// --- Lead Source (SET-06) ---
export const createLeadSource = tenantAction(leadSourceSchema, async (ctx, { name }) => {
  assertCan(ctx, "create", "LeadSource");
  if (
    await ctx.db.leadSource.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })
  ) {
    throw new AppError("Nama sumber sudah ada");
  }
  const s = await ctx.db.leadSource.create({ data: { name } as never });
  await writeAudit(ctx, {
    action: "lead_source.created",
    entityType: "LeadSource",
    entityId: s.id,
    after: { name },
  });
  revalidatePath("/settings/lead-sources");
});

export const renameLeadSource = tenantAction(renameLeadSourceSchema, async (ctx, { id, name }) => {
  assertCan(ctx, "update", "LeadSource");
  const s = await ctx.db.leadSource.findFirst({ where: { id } });
  if (!s) throw NotFoundError("Sumber lead");
  if (s.isSystem) throw new AppError("Sumber sistem tidak dapat diubah namanya");
  const dup = await ctx.db.leadSource.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
  });
  if (dup) throw new AppError("Nama sumber sudah ada");
  await ctx.db.leadSource.update({ where: { id }, data: { name } });
  await writeAudit(ctx, {
    action: "lead_source.renamed",
    entityType: "LeadSource",
    entityId: id,
    before: { name: s.name },
    after: { name },
  });
  revalidatePath("/settings/lead-sources");
});

export const toggleLeadSource = tenantAction(
  toggleLeadSourceSchema,
  async (ctx, { id, isActive }) => {
    assertCan(ctx, "update", "LeadSource");
    const s = await ctx.db.leadSource.findFirst({ where: { id } });
    if (!s) throw NotFoundError("Sumber lead");
    if (s.isSystem && !isActive) throw new AppError("Sumber sistem tidak dapat dinonaktifkan");
    await ctx.db.leadSource.update({ where: { id }, data: { isActive } });
    await writeAudit(ctx, {
      action: isActive ? "lead_source.activated" : "lead_source.deactivated",
      entityType: "LeadSource",
      entityId: id,
    });
    revalidatePath("/settings/lead-sources");
  },
);

/** Konversi lead (plan 1.7): contact/company/deal dibuat atau ditautkan secara atomik. */
export const convertLead = tenantAction(convertLeadSchema, async (ctx, input) => {
  const result = await convertLeadService(ctx, input);
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/contacts");
  revalidatePath("/companies");
  revalidatePath("/deals");
  return result;
});
