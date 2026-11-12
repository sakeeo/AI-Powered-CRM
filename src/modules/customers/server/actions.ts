"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  assignSegmentSchema,
  removeSegmentSchema,
  type PartyType,
} from "@/modules/customers/schemas";
import { getCustomer360 } from "@/modules/customers/server/queries";

const link = (type: PartyType, id: string) =>
  type === "company" ? { companyId: id } : { contactId: id };

/** Segmentasi hanya untuk customer (punya deal Won yang boleh dilihat pengguna). */
async function assertCustomer(ctx: ActionContext, type: PartyType, id: string) {
  await getCustomer360(ctx, type, id);
}

/** Tambahkan customer ke segmen (dibuat otomatis bila belum ada). Butuh izin update pada contact/company-nya. */
export const assignSegment = tenantAction(assignSegmentSchema, async (ctx, { type, id, name }) => {
  assertCan(ctx, "update", type === "company" ? "Company" : "Contact");
  await assertCustomer(ctx, type, id);
  let segment = await ctx.db.customerSegment.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (segment?.kind === "dynamic")
    throw new AppError(
      "Segmen dinamis dihitung otomatis dari aturannya; tidak bisa ditambah manual",
    );
  segment ??= await ctx.db.customerSegment.create({ data: { name } as never });
  const exists = await ctx.db.customerSegmentMember.findFirst({
    where: { segmentId: segment.id, ...link(type, id) },
  });
  if (!exists) {
    await ctx.db.customerSegmentMember.create({
      data: { segmentId: segment.id, ...link(type, id) } as never,
    });
    await writeAudit(ctx, {
      action: "customer.segment_assigned",
      entityType: type === "company" ? "Company" : "Contact",
      entityId: id,
      after: { segment: segment.name },
    });
  }
  revalidatePath(`/customers/${type}/${id}`);
  revalidatePath("/customers");
});

export const removeSegment = tenantAction(
  removeSegmentSchema,
  async (ctx, { type, id, segmentId }) => {
    assertCan(ctx, "update", type === "company" ? "Company" : "Contact");
    await assertCustomer(ctx, type, id);
    const res = await ctx.db.customerSegmentMember.deleteMany({
      where: { segmentId, ...link(type, id) },
    });
    if (!res.count) throw NotFoundError("Segmen");
    await writeAudit(ctx, {
      action: "customer.segment_removed",
      entityType: type === "company" ? "Company" : "Contact",
      entityId: id,
      after: { segmentId },
    });
    revalidatePath(`/customers/${type}/${id}`);
    revalidatePath("/customers");
  },
);
