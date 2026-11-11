import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams } from "@/lib/list-params";
import { decimalToString } from "@/lib/money-db";
import { DEFAULT_LEAD_SOURCES } from "@/modules/leads/constants";

type Where = Prisma.LeadWhereInput;
type Db = TenantContext["db"];

/** Pastikan organisasi (termasuk yang dibuat sebelum fitur ini) punya sumber lead bawaan. */
export async function ensureLeadSources(db: Db) {
  const count = await db.leadSource.count();
  if (count > 0) return;
  await db.leadSource.createMany({
    data: DEFAULT_LEAD_SOURCES.map((s) => ({ name: s.name, isSystem: !!s.isSystem })) as never,
    skipDuplicates: true,
  });
}

export async function listLeadSources(ctx: TenantContext, opts: { activeOnly?: boolean } = {}) {
  assertCan(ctx, "view", "LeadSource");
  await ensureLeadSources(ctx.db);
  return ctx.db.leadSource.findMany({
    where: opts.activeOnly ? { isActive: true } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { leads: true } } },
  });
}

export type LeadFilters = {
  status?: string;
  sourceId?: string;
  /** uuid pemilik, atau "unassigned" untuk lead tanpa owner */
  owner?: string;
  archived?: boolean;
};

export async function listLeads(ctx: TenantContext, params: ListParams, filters: LeadFilters = {}) {
  const q = params.q;
  const where: Where = {
    AND: [
      filters.archived ? { archivedAt: { not: null } } : { archivedAt: null },
      scopeWhere(ctx, "view", "Lead") as Where,
      ...(filters.status ? [{ status: filters.status }] : []),
      ...(filters.sourceId ? [{ sourceId: filters.sourceId }] : []),
      ...(filters.owner
        ? [filters.owner === "unassigned" ? { ownerId: null } : { ownerId: filters.owner }]
        : []),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { companyName: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q } },
              ],
            },
          ]
        : []),
    ],
  };
  const [total, rows] = await Promise.all([
    ctx.db.lead.count({ where }),
    ctx.db.lead.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: { source: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    total,
    page: params.page,
    pageSize: params.pageSize,
    rows: rows.map((r) => ({ ...r, budget: decimalToString(r.budget) })),
  };
}

export async function getLead(ctx: TenantContext, id: string) {
  const row = await ctx.db.lead.findFirst({
    where: { AND: [{ id }, scopeWhere(ctx, "view", "Lead") as Where] },
    include: { source: { select: { id: true, name: true } } },
  });
  if (!row) throw NotFoundError("Lead");
  assertCan(ctx, "view", "Lead", row);
  return { ...row, budget: decimalToString(row.budget) };
}
