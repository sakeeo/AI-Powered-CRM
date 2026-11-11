import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams } from "@/lib/list-params";

type Where = Prisma.CompanyWhereInput;

export async function listCompanies(
  ctx: TenantContext,
  params: ListParams,
  filters: { ownerId?: string } = {},
) {
  const q = params.q;
  const where: Where = {
    AND: [
      { deletedAt: null },
      scopeWhere(ctx, "view", "Company") as Where,
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
      ...(filters.ownerId ? [{ ownerId: filters.ownerId }] : []),
    ],
  };
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
