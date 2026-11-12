"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { partySchema } from "@/modules/customers/schemas";
import { getCustomer360 } from "@/modules/customers/server/queries";

/**
 * Buat task follow-up repeat purchase untuk customer (aksi eksplisit pengguna). Tidak membuat ganda:
 * bila sudah ada task terbuka dengan judul yang sama untuk customer itu, ditolak.
 */
export const createRepeatFollowUp = tenantAction(partySchema, async (ctx, { type, id }) => {
  assertCan(ctx, "create", "Activity");
  const c = await getCustomer360(ctx, type, id);
  const link = type === "company" ? { companyId: id } : { contactId: id };
  const subject = `Follow-up repeat order: ${c.name}`.slice(0, 160);
  const exists = await ctx.db.activity.findFirst({
    where: { ...link, type: "task", status: "open", subject },
    select: { id: true },
  });
  if (exists) throw new AppError("Sudah ada follow-up terbuka untuk customer ini");
  const a = await ctx.db.activity.create({
    data: {
      type: "task",
      subject,
      status: "open",
      dueAt: new Date(),
      ownerId: ctx.userId,
      createdBy: ctx.userId,
      ...link,
    } as never,
  });
  await writeAudit(ctx, {
    action: "customer.repeat_followup_created",
    entityType: type === "company" ? "Company" : "Contact",
    entityId: id,
    after: { activityId: a.id },
  });
  revalidatePath("/customers");
  revalidatePath("/activities");
  return { id: a.id };
});
