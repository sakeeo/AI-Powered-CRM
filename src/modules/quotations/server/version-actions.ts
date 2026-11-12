"use server";

import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { assertCan, scopeWhere } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { diffSnapshots } from "@/modules/quotations/versioning";
import { saveQuotation } from "@/modules/quotations/server/actions";
import { getVersionSnapshots, recordVersion } from "@/modules/quotations/server/versions";

async function ownQuotation(
  ctx: Parameters<Parameters<typeof tenantAction>[1]>[0],
  id: string,
  action: "view" | "update",
) {
  const q = await ctx.db.quotation.findFirst({
    where: { AND: [{ id, deletedAt: null }, scopeWhere(ctx, "view", "Quotation")] } as never,
  });
  if (!q) throw NotFoundError("Quotation");
  assertCan(ctx, action, "Quotation", q);
  return q;
}

const compareSchema = z.object({
  id: z.uuid(),
  from: z.number().int().min(1),
  to: z.number().int().min(1),
});

/** Bandingkan dua versi quotation (perubahan header, item, dan selisih total). */
export const compareQuotationVersions = tenantAction(
  compareSchema,
  async (ctx, { id, from, to }) => {
    await ownQuotation(ctx, id, "view");
    const snaps = await getVersionSnapshots(ctx.db, id, [from, to]);
    const a = snaps.get(from);
    const b = snaps.get(to);
    if (!a || !b) throw NotFoundError("Versi");
    return diffSnapshots(a, b);
  },
);

const restoreSchema = z.object({ id: z.uuid(), version: z.number().int().min(1) });

/** Pulihkan isi Draft dari versi lama (tercatat sebagai versi baru; total dihitung ulang server). */
export const restoreQuotationVersion = tenantAction(restoreSchema, async (ctx, { id, version }) => {
  const q = await ownQuotation(ctx, id, "update");
  if (q.status !== "draft") throw new AppError("Hanya quotation Draft yang dapat dipulihkan");
  const snap = (await getVersionSnapshots(ctx.db, id, [version])).get(version);
  if (!snap) throw NotFoundError("Versi");
  const latest = async () =>
    (
      await ctx.db.quotationVersion.findFirst({
        where: { quotationId: id },
        orderBy: { version: "desc" },
      })
    )?.version ?? 0;
  const before = await latest();
  const res = await saveQuotation({
    id,
    title: snap.title,
    validUntil: snap.validUntil,
    currency: snap.currency as never,
    contactId: snap.contactId ?? undefined,
    companyId: snap.companyId ?? undefined,
    notes: snap.notes ?? undefined,
    terms: snap.terms ?? undefined,
    narrative: snap.narrative ?? undefined,
    globalDiscountPercent: snap.globalDiscountPercent,
    items: snap.items.map((i) => ({
      productId: i.productId ?? undefined,
      name: i.name,
      description: i.description ?? undefined,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountPercent: i.discountPercent,
    })),
  });
  if (!res.ok) throw new AppError(res.error);
  const label = `Dipulihkan dari v${version}`;
  const after = await latest();
  if (after > before)
    await ctx.db.quotationVersion.updateMany({
      where: { quotationId: id, version: after },
      data: { label },
    });
  else await recordVersion(ctx.db, id, { label, userId: ctx.userId, force: true });
  return { restoredFrom: version };
});
