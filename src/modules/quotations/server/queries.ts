import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams } from "@/lib/list-params";

type Where = Prisma.QuotationWhereInput;

const include = {
  deal: { select: { id: true, title: true } },
  contact: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

const ser = <
  T extends {
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    globalDiscountPercent: Prisma.Decimal;
    issueDate: Date;
    validUntil: Date;
  },
>(
  q: T,
) => ({
  ...q,
  subtotal: q.subtotal.toFixed(2),
  discountTotal: q.discountTotal.toFixed(2),
  taxTotal: q.taxTotal.toFixed(2),
  total: q.total.toFixed(2),
  taxRate: q.taxRate.toFixed(2),
  globalDiscountPercent: q.globalDiscountPercent.toFixed(2),
  issueDate: q.issueDate.toISOString().slice(0, 10),
  validUntil: q.validUntil.toISOString().slice(0, 10),
});

export function quotationWhere(
  ctx: TenantContext,
  filters: { status?: string; dealId?: string },
  q?: string,
): Where {
  return {
    AND: [
      { deletedAt: null },
      scopeWhere(ctx, "view", "Quotation") as Where,
      ...(filters.status ? [{ status: filters.status }] : []),
      ...(filters.dealId ? [{ dealId: filters.dealId }] : []),
      ...(q
        ? [
            {
              OR: [
                { number: { contains: q, mode: "insensitive" as const } },
                { title: { contains: q, mode: "insensitive" as const } },
                { contact: { name: { contains: q, mode: "insensitive" as const } } },
                { company: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            },
          ]
        : []),
    ],
  };
}

export async function listQuotations(
  ctx: TenantContext,
  params: ListParams,
  filters: { status?: string; dealId?: string } = {},
) {
  assertCan(ctx, "view", "Quotation");
  const where = quotationWhere(ctx, filters, params.q);
  const [total, rows] = await Promise.all([
    ctx.db.quotation.count({ where }),
    ctx.db.quotation.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include,
    }),
  ]);
  return { total, page: params.page, pageSize: params.pageSize, rows: rows.map(ser) };
}

export async function getQuotation(ctx: TenantContext, id: string) {
  const row = await ctx.db.quotation.findFirst({
    where: { AND: [{ id, deletedAt: null }, scopeWhere(ctx, "view", "Quotation") as Where] },
    include: { ...include, items: { orderBy: { position: "asc" } } },
  });
  if (!row) throw NotFoundError("Quotation");
  assertCan(ctx, "view", "Quotation", row);
  return {
    ...ser(row),
    items: row.items.map((i) => ({
      ...i,
      quantity: i.quantity.toFixed(2),
      unitPrice: i.unitPrice.toFixed(2),
      discountPercent: i.discountPercent.toFixed(2),
      lineTotal: i.lineTotal.toFixed(2),
    })),
  };
}
export type QuotationDetail = Awaited<ReturnType<typeof getQuotation>>;

export async function listQuotationsForDeal(ctx: TenantContext, dealId: string) {
  const rows = await ctx.db.quotation.findMany({
    where: quotationWhere(ctx, { dealId }),
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, number: true, title: true, status: true, total: true, currency: true },
  });
  return rows.map((r) => ({ ...r, total: r.total.toFixed(2) }));
}

/** Deal terbuka (yang boleh dilihat) untuk dipilih saat membuat quotation. */
export async function listDealOptions(ctx: TenantContext) {
  return ctx.db.deal.findMany({
    where: { AND: [{ deletedAt: null }, scopeWhere(ctx, "view", "Deal")] } as never,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, title: true },
  });
}
