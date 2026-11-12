import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams } from "@/lib/list-params";

type Where = Prisma.CompanyWhereInput;

function companyWhere(
  ctx: TenantContext,
  q: string | undefined,
  ownerId?: string,
  extra: Record<string, unknown>[] = [],
): Where {
  return {
    AND: [
      { deletedAt: null },
      scopeWhere(ctx, "view", "Company") as Where,
      ...(extra as Where[]),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { industry: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q } },
              ],
            },
          ]
        : []),
      ...(ownerId ? [{ ownerId }] : []),
    ],
  };
}

export async function listCompanies(
  ctx: TenantContext,
  params: ListParams,
  filters: { ownerId?: string; extra?: Record<string, unknown>[] } = {},
) {
  const where = companyWhere(ctx, params.q, filters.ownerId, filters.extra);
  const [total, rows] = await Promise.all([
    ctx.db.company.count({ where }),
    ctx.db.company.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: { _count: { select: { contacts: true } } },
    }),
  ]);
  return { rows, total, page: params.page, pageSize: params.pageSize };
}

export async function getCompany(ctx: TenantContext, id: string) {
  const row = await ctx.db.company.findFirst({
    where: { AND: [{ id, deletedAt: null }, scopeWhere(ctx, "view", "Company") as Where] },
    include: {
      contacts: {
        include: {
          contact: { select: { id: true, name: true, email: true, phone: true, deletedAt: true } },
        },
        orderBy: { isPrimary: "desc" },
      },
    },
  });
  if (!row) throw NotFoundError("Company");
  assertCan(ctx, "view", "Company", row);
  return { ...row, contacts: row.contacts.filter((c) => !c.contact.deletedAt) };
}

/** Perusahaan sesuai pencarian/owner & izin (untuk export). */
export async function listCompaniesForExport(
  ctx: TenantContext,
  q: string | undefined,
  ownerId: string | undefined,
  take: number,
  extra: Record<string, unknown>[] = [],
) {
  assertCan(ctx, "export", "Company");
  return ctx.db.company.findMany({
    where: companyWhere(ctx, q, ownerId, extra),
    orderBy: { createdAt: "desc" },
    take,
  });
}
