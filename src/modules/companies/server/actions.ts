"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan, resolveOwner } from "@/lib/authz";
import { NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import { companySchema, updateCompanySchema } from "@/modules/contacts/schemas";
import { assertActiveMember } from "@/modules/organizations/server/queries";

export const createCompany = tenantAction(companySchema, async (ctx, input) => {
  assertCan(ctx, "create", "Company");
  const { ownerId: requested, ...data } = input;
  const ownerId = resolveOwner(ctx, requested);
  if (ownerId !== ctx.userId) await assertActiveMember(ctx, ownerId);
  const company = await ctx.db.company.create({
    data: { ...data, ownerId, createdBy: ctx.userId } as never,
  });
  await writeAudit(ctx, {
    action: "company.created",
    entityType: "Company",
    entityId: company.id,
    after: { name: company.name },
  });
  revalidatePath("/companies");
  return { id: company.id };
});

export const updateCompany = tenantAction(updateCompanySchema, async (ctx, input) => {
  const { id, ownerId: requested, ...data } = input;
  const existing = await ctx.db.company.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Company");
  assertCan(ctx, "update", "Company", existing);
  const ownerId = ctx.role === "sales_rep" ? existing.ownerId : (requested ?? existing.ownerId);
  if (ownerId && ownerId !== existing.ownerId) await assertActiveMember(ctx, ownerId);
  await ctx.db.company.update({ where: { id }, data: { ...data, ownerId, updatedBy: ctx.userId } });
  await writeAudit(ctx, {
    action: "company.updated",
    entityType: "Company",
    entityId: id,
    before: { name: existing.name, ownerId: existing.ownerId },
    after: { name: data.name, ownerId },
  });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
});

export const deleteCompany = tenantAction(idInput, async (ctx, { id }) => {
  const existing = await ctx.db.company.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Company");
  assertCan(ctx, "delete", "Company", existing);
  await ctx.db.company.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: "company.deleted",
    entityType: "Company",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/companies");
});
