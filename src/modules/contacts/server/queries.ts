import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams, Paged } from "@/lib/list-params";

type Where = Prisma.ContactWhereInput;

function searchWhere(q?: string): Where | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ],
  };
}

const companyInclude = {
  companies: {
    orderBy: { isPrimary: "desc" as const },
    include: { company: { select: { id: true, name: true } } },
  },
};

export async function listContacts(
  ctx: TenantContext,
  params: ListParams,
  filters: { ownerId?: string } = {},
) {
  const where: Where = {
    AND: [
      { deletedAt: null },
      scopeWhere(ctx, "view", "Contact") as Where,
      ...(searchWhere(params.q) ? [searchWhere(params.q)!] : []),
      ...(filters.ownerId ? [{ ownerId: filters.ownerId }] : []),
    ],
  };
  const [total, rows] = await Promise.all([
    ctx.db.contact.count({ where }),
    ctx.db.contact.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: companyInclude,
    }),
  ]);
  const paged: Paged<(typeof rows)[number]> = {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
  return paged;
}

export async function getContact(ctx: TenantContext, id: string) {
  const row = await ctx.db.contact.findFirst({
    where: { AND: [{ id, deletedAt: null }, scopeWhere(ctx, "view", "Contact") as Where] },
    include: companyInclude,
  });
  if (!row) throw NotFoundError("Contact");
  assertCan(ctx, "view", "Contact", row);
  return row;
}

/** Opsi company untuk multi-select (maks. 300 terbaru/alfabet). */
export async function listCompanyOptions(ctx: TenantContext) {
  assertCan(ctx, "view", "Company");
  return ctx.db.company.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    take: 300,
    select: { id: true, name: true },
  });
}
