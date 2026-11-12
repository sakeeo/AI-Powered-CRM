"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import {
  createDynamicSegmentSchema,
  updateDynamicSegmentSchema,
} from "@/modules/customers/segment-rules";

const MANAGERS = ["owner", "admin", "sales_manager"];
const assertManage = (ctx: ActionContext) => {
  if (!MANAGERS.includes(ctx.role)) throw ForbiddenError();
};

async function assertTags(ctx: ActionContext, tagIds?: string[]) {
  if (!tagIds?.length) return;
  const n = await ctx.db.tag.count({ where: { id: { in: [...new Set(tagIds)] } } });
  if (n !== new Set(tagIds).size) throw new AppError("Ada tag yang tidak ditemukan");
}

/** Segmen dinamis: anggota dihitung dari aturan (tag, nilai, recency); tidak ada salinan keanggotaan. */
export const createDynamicSegment = tenantAction(createDynamicSegmentSchema, async (ctx, input) => {
  assertManage(ctx);
  await assertTags(ctx, input.rules.tagIds);
  const dup = await ctx.db.customerSegment.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (dup) throw new AppError("Nama segmen sudah dipakai");
  const seg = await ctx.db.customerSegment.create({
    data: { name: input.name, kind: "dynamic", rules: input.rules } as never,
  });
  await writeAudit(ctx, {
    action: "customer.segment_created",
    entityType: "CustomerSegment",
    entityId: seg.id,
    after: { name: input.name, rules: input.rules },
  });
  revalidatePath("/customers");
  return { id: seg.id };
});

export const updateDynamicSegment = tenantAction(updateDynamicSegmentSchema, async (ctx, input) => {
  assertManage(ctx);
  const seg = await ctx.db.customerSegment.findFirst({ where: { id: input.id, kind: "dynamic" } });
  if (!seg) throw NotFoundError("Segmen");
  await assertTags(ctx, input.rules.tagIds);
  const dup = await ctx.db.customerSegment.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, NOT: { id: input.id } },
  });
  if (dup) throw new AppError("Nama segmen sudah dipakai");
  await ctx.db.customerSegment.update({
    where: { id: input.id },
    data: { name: input.name, rules: input.rules } as never,
  });
  await writeAudit(ctx, {
    action: "customer.segment_updated",
    entityType: "CustomerSegment",
    entityId: input.id,
    before: { name: seg.name, rules: seg.rules },
    after: { name: input.name, rules: input.rules },
  });
  revalidatePath("/customers");
});

export const deleteDynamicSegment = tenantAction(idInput, async (ctx, { id }) => {
  assertManage(ctx);
  const seg = await ctx.db.customerSegment.findFirst({ where: { id, kind: "dynamic" } });
  if (!seg) throw NotFoundError("Segmen");
  await ctx.db.customerSegment.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "customer.segment_deleted",
    entityType: "CustomerSegment",
    entityId: id,
    before: { name: seg.name },
  });
  revalidatePath("/customers");
});
