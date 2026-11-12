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
  filters: { ownerId?: string; extra?: Record<string, unknown>[] } = {},
) {
  const where: Where = {
    AND: [
      { deletedAt: null },
      scopeWhere(ctx, "view", "Contact") as Where,
      ...((filters.extra ?? []) as Where[]),
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

/** Opsi contact untuk dropdown (maks. 300, alfabet). */
export async function listContactOptions(ctx: TenantContext) {
  assertCan(ctx, "view", "Contact");
  return ctx.db.contact.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    take: 300,
    select: { id: true, name: true },
  });
}

/** Kontak sesuai pencarian/owner & izin (untuk export). */
export async function listContactsForExport(
  ctx: TenantContext,
  q: string | undefined,
  ownerId: string | undefined,
  take: number,
  extra: Record<string, unknown>[] = [],
) {
  assertCan(ctx, "export", "Contact");
  return ctx.db.contact.findMany({
    where: {
      AND: [
        { deletedAt: null },
        scopeWhere(ctx, "view", "Contact") as Where,
        ...(extra as Where[]),
        ...(searchWhere(q) ? [searchWhere(q)!] : []),
        ...(ownerId ? [{ ownerId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    include: companyInclude,
  });
}
