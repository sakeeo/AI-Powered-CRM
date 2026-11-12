"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan, resolveOwner } from "@/lib/authz";
import { emitBusinessEvent } from "@/lib/outbound-webhooks";
import {
  contactPayload,
} from "@/modules/integrations/payloads";

import { AppError, NotFoundError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { idInput } from "@/lib/schema-helpers";
import { applyTags, prepareCustomFields } from "@/modules/customization/server/apply";
import { contactSchema, updateContactSchema } from "@/modules/contacts/schemas";
import { assertActiveMember } from "@/modules/organizations/server/queries";

async function assertCompanies(ctx: ActionContext, ids: string[]) {
  if (!ids.length) return;
  const found = await ctx.db.company.count({ where: { id: { in: ids }, deletedAt: null } });
  if (found !== new Set(ids).size) throw new AppError("Ada company yang tidak ditemukan");
}

function linkRows(companyIds: string[], contactId: string) {
  return Array.from(new Set(companyIds)).map((companyId, i) => ({
    contactId,
    companyId,
    isPrimary: i === 0,
  }));
}

export const createContact = tenantAction(contactSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Contact");
  const { companyIds, ownerId: requested, customFields, tagIds, ...data } = input;
  const ownerId = resolveOwner(ctx, requested);
  if (ownerId !== ctx.userId) await assertActiveMember(ctx, ownerId);
  await assertCompanies(ctx, companyIds);
  const cf = await prepareCustomFields(ctx, "contact", customFields);
  const contact = await ctx.db.$transaction(async (tx) => {
    const c = await tx.contact.create({
      data: {
        ...data,
        customFields: cf,
        phoneNormalized: normalizePhone(data.phone),
        ownerId,
        createdBy: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });
    if (companyIds.length) {
      await tx.contactCompany.createMany({
        data: linkRows(companyIds, c.id).map((r) => ({ ...r, organizationId: ctx.organizationId })),
      });
    }
    return c;
  });
  if (tagIds?.length) await applyTags(ctx, "contact", contact.id, tagIds);
  await emitBusinessEvent(ctx.organizationId, "contact.created", `contact.created:${contact.id}`, contactPayload(contact));
  await writeAudit(ctx, {
    action: "contact.created",
    entityType: "Contact",
    entityId: contact.id,
    after: { name: contact.name },
  });
  revalidatePath("/contacts");
  return { id: contact.id };
});

export const updateContact = tenantAction(updateContactSchema, async (ctx, input) => {
  const { id, companyIds, ownerId: requested, customFields, tagIds, ...data } = input;
  const existing = await ctx.db.contact.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Contact");
  assertCan(ctx, "update", "Contact", existing);
  const ownerId = ctx.role === "sales_rep" ? existing.ownerId : (requested ?? existing.ownerId);
  if (ownerId && ownerId !== existing.ownerId) await assertActiveMember(ctx, ownerId);
  await assertCompanies(ctx, companyIds);
  const cf = customFields
    ? await prepareCustomFields(ctx, "contact", customFields, existing.customFields)
    : undefined;
  await ctx.db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id },
      data: {
        ...data,
        ...(cf ? { customFields: cf } : {}),
        phoneNormalized: normalizePhone(data.phone),
        ownerId,
        updatedBy: ctx.userId,
      },
    });
    await tx.contactCompany.deleteMany({ where: { contactId: id } });
    if (companyIds.length) {
      await tx.contactCompany.createMany({
        data: linkRows(companyIds, id).map((r) => ({ ...r, organizationId: ctx.organizationId })),
      });
    }
  });
  if (tagIds) await applyTags(ctx, "contact", id, tagIds);
  await writeAudit(ctx, {
    action: "contact.updated",
    entityType: "Contact",
    entityId: id,
    before: { name: existing.name, ownerId: existing.ownerId },
    after: { name: data.name, ownerId },
  });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
});

/** Hapus lunak (deleted_at) — kebijakan retensi final di plan 1.20. */
export const deleteContact = tenantAction(idInput, async (ctx, { id }) => {
  const existing = await ctx.db.contact.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Contact");
  assertCan(ctx, "delete", "Contact", existing);
  await ctx.db.contact.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: "contact.deleted",
    entityType: "Contact",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/contacts");
});
