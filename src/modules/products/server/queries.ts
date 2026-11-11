import type { Prisma } from "@/generated/prisma/client";
import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import type { ListParams } from "@/lib/list-params";

type Where = Prisma.ProductWhereInput;

export type ProductFilters = { status?: string; categoryId?: string };

export async function listProducts(
  ctx: TenantContext,
  params: ListParams,
  filters: ProductFilters = {},
) {
  assertCan(ctx, "view", "Product");
  const q = params.q;
  const where: Where = {
    AND: [
      { deletedAt: null },
      ...(filters.status === "active"
        ? [{ isActive: true }]
        : filters.status === "inactive"
          ? [{ isActive: false }]
          : []),
      ...(filters.categoryId ? [{ categoryId: filters.categoryId }] : []),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { sku: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };
  const [total, rows] = await Promise.all([
    ctx.db.product.count({ where }),
    ctx.db.product.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: { category: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    total,
    page: params.page,
    pageSize: params.pageSize,
    rows: rows.map((r) => ({ ...r, price: r.price.toFixed(2) })),
  };
}

export async function listCategories(ctx: TenantContext) {
  assertCan(ctx, "view", "Product");
  return ctx.db.productCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Produk aktif untuk dipilih pada deal. */
export async function listActiveProducts(ctx: TenantContext) {
  assertCan(ctx, "view", "Product");
  const rows = await ctx.db.product.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true, currency: true },
  });
  return rows.map((r) => ({ ...r, price: r.price.toFixed(2) }));
}

export async function listDealProducts(ctx: TenantContext, dealId: string) {
  const rows = await ctx.db.dealProduct.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ ...r, unitPrice: r.unitPrice.toFixed(2) }));
}
