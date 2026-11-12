"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { emitBusinessEvent } from "@/lib/outbound-webhooks";
import { productPayload } from "@/modules/integrations/payloads";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { toDecimal } from "@/lib/money-db";
import { idInput } from "@/lib/schema-helpers";
import {
  addDealProductSchema,
  productSchema,
  removeDealProductSchema,
  setProductActiveSchema,
  updateProductSchema,
} from "@/modules/products/schemas";

async function resolveCategory(ctx: ActionContext, name?: string) {
  if (!name) return null;
  const found = await ctx.db.productCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (found) return found.id;
  const created = await ctx.db.productCategory.create({ data: { name } as never });
  return created.id;
}

async function assertSkuFree(ctx: ActionContext, sku?: string, exceptId?: string) {
  if (!sku) return;
  const dup = await ctx.db.product.findFirst({
    where: {
      sku: { equals: sku, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  if (dup) throw new AppError("SKU sudah dipakai produk lain");
}

export const createProduct = tenantAction(productSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Product");
  const { categoryName, price, ...data } = input;
  await assertSkuFree(ctx, data.sku);
  const categoryId = await resolveCategory(ctx, categoryName);
  const p = await ctx.db.product.create({
    data: { ...data, price: toDecimal(price)!, categoryId, createdBy: ctx.userId } as never,
  });
  await writeAudit(ctx, {
    action: "product.created",
    entityType: "Product",
    entityId: p.id,
    after: { name: p.name, price, currency: data.currency },
  });
  await emitBusinessEvent(
    ctx.organizationId,
    "product.created",
    `product.created:${p.id}`,
    productPayload(p),
  );
  revalidatePath("/products");
  return { id: p.id };
});

export const updateProduct = tenantAction(updateProductSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Product");
  const { id, categoryName, price, ...data } = input;
  const existing = await ctx.db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Produk");
  await assertSkuFree(ctx, data.sku, id);
  const categoryId = await resolveCategory(ctx, categoryName);
  const updated = await ctx.db.product.update({
    where: { id },
    data: {
      ...data,
      sku: data.sku ?? null,
      description: data.description ?? null,
      price: toDecimal(price)!,
      categoryId,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "product.updated",
    entityType: "Product",
    entityId: id,
    before: { name: existing.name, price: existing.price.toFixed(2), isActive: existing.isActive },
    after: { name: data.name, price, isActive: data.isActive },
  });
  await emitBusinessEvent(
    ctx.organizationId,
    "product.updated",
    `product.updated:${id}:${updated.updatedAt.getTime()}`,
    productPayload(updated),
  );
  revalidatePath("/products");
});

export const setProductActive = tenantAction(
  setProductActiveSchema,
  async (ctx, { id, isActive }) => {
    assertCan(ctx, "update", "Product");
    const existing = await ctx.db.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw NotFoundError("Produk");
    const updated = await ctx.db.product.update({
      where: { id },
      data: { isActive, updatedBy: ctx.userId },
    });
    await writeAudit(ctx, {
      action: isActive ? "product.activated" : "product.deactivated",
      entityType: "Product",
      entityId: id,
    });
    await emitBusinessEvent(
      ctx.organizationId,
      "product.updated",
      `product.updated:${id}:${updated.updatedAt.getTime()}`,
      productPayload(updated),
    );
    revalidatePath("/products");
  },
);

/** Soft delete; SKU dilepas agar bisa dipakai ulang. Item deal yang sudah ada tetap (snapshot). */
export const deleteProduct = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "delete", "Product");
  const existing = await ctx.db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Produk");
  await ctx.db.product.update({
    where: { id },
    data: { deletedAt: new Date(), sku: null, isActive: false, updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: "product.deleted",
    entityType: "Product",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/products");
});

// --- Produk pada deal (DEAL-13) ---
async function loadOpenDeal(ctx: ActionContext, dealId: string) {
  const deal = await ctx.db.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw NotFoundError("Deal");
  assertCan(ctx, "update", "Deal", deal);
  if (deal.status !== "open") throw new AppError("Deal yang sudah ditutup tidak dapat diubah");
  return deal;
}

export const addDealProduct = tenantAction(addDealProductSchema, async (ctx, input) => {
  await loadOpenDeal(ctx, input.dealId);
  const product = await ctx.db.product.findFirst({
    where: { id: input.productId, deletedAt: null, isActive: true },
  });
  if (!product) throw new AppError("Produk tidak tersedia");
  let unit = product.price;
  if (input.unitPrice) {
    const m = /^\d{1,16}(\.\d{1,2})?$/.exec(input.unitPrice.replace(/[\s,]/g, ""));
    if (!m) throw new AppError("Harga satuan tidak valid (maks. 2 desimal)");
    unit = toDecimal(m[0])!;
  }
  const item = await ctx.db.dealProduct.create({
    data: {
      dealId: input.dealId,
      productId: product.id,
      name: product.name,
      quantity: input.quantity,
      unitPrice: unit,
      currency: product.currency,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "deal.product_added",
    entityType: "Deal",
    entityId: input.dealId,
    after: { product: product.name, quantity: input.quantity, unitPrice: unit.toFixed(2) },
  });
  revalidatePath(`/deals/${input.dealId}`);
  return { id: item.id };
});

export const removeDealProduct = tenantAction(removeDealProductSchema, async (ctx, { id }) => {
  const item = await ctx.db.dealProduct.findFirst({ where: { id } });
  if (!item) throw NotFoundError("Item");
  await loadOpenDeal(ctx, item.dealId);
  await ctx.db.dealProduct.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "deal.product_removed",
    entityType: "Deal",
    entityId: item.dealId,
    before: { product: item.name, quantity: item.quantity },
  });
  revalidatePath(`/deals/${item.dealId}`);
});
