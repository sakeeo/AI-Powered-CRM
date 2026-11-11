import { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams } from "@/lib/list-params";
import { decimalToString } from "@/lib/money-db";
import { ensureDefaultPipeline } from "@/modules/deals/server/pipeline";

type Where = Prisma.DealWhereInput;

export async function getDefaultPipeline(ctx: TenantContext) {
  assertCan(ctx, "view", "Pipeline");
  return ensureDefaultPipeline(ctx.db);
}

export type DealFilters = {
  stageId?: string;
  status?: string;
  owner?: string;
  contactId?: string;
  companyId?: string;
};

const include = {
  stage: { select: { id: true, name: true, probability: true } },
  contact: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

function serialize<T extends { value: Prisma.Decimal; expectedCloseDate: Date | null }>(d: T) {
  return {
    ...d,
    value: d.value.toFixed(2),
    expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0, 10) : null,
  };
}

export function dealWhere(ctx: TenantContext, filters: DealFilters, q?: string): Where {
  return {
    AND: [
      { deletedAt: null },
      scopeWhere(ctx, "view", "Deal") as Where,
      ...(filters.stageId ? [{ stageId: filters.stageId }] : []),
      ...(filters.status ? [{ status: filters.status }] : []),
      ...(filters.contactId ? [{ contactId: filters.contactId }] : []),
      ...(filters.companyId ? [{ companyId: filters.companyId }] : []),
      ...(filters.owner
        ? [filters.owner === "unassigned" ? { ownerId: null } : { ownerId: filters.owner }]
        : []),
      ...(q
        ? [
            {
              OR: [
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

export async function listDeals(ctx: TenantContext, params: ListParams, filters: DealFilters = {}) {
  const where = dealWhere(ctx, filters, params.q);
  const [total, rows] = await Promise.all([
    ctx.db.deal.count({ where }),
    ctx.db.deal.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include,
    }),
  ]);
  return { total, page: params.page, pageSize: params.pageSize, rows: rows.map(serialize) };
}

export async function getDeal(ctx: TenantContext, id: string) {
  const row = await ctx.db.deal.findFirst({
    where: { AND: [{ id, deletedAt: null }, scopeWhere(ctx, "view", "Deal") as Where] },
    include,
  });
  if (!row) throw NotFoundError("Deal");
  assertCan(ctx, "view", "Deal", row);
  return serialize(row);
}

/** Deal terkait contact/company (related deals), hanya yang boleh dilihat pengguna. */
export async function listRelatedDeals(
  ctx: TenantContext,
  filter: { contactId?: string; companyId?: string },
) {
  const rows = await ctx.db.deal.findMany({
    where: dealWhere(ctx, filter),
    orderBy: { createdAt: "desc" },
    take: 50,
    include,
  });
  return rows.map(serialize);
}

export type StageSummary = {
  stageId: string;
  name: string;
  count: number;
  /** total nilai per mata uang (string desimal) */
  totals: Record<string, string>;
  /** nilai tertimbang probabilitas per mata uang */
  weighted: Record<string, string>;
};

/**
 * Ringkasan nilai pipeline per stage (DEAL-14) untuk deal OPEN, dihitung dengan Decimal.
 * Nilai tertimbang = nilai × (probabilitas deal ?? probabilitas stage) / 100.
 */
export async function pipelineSummary(
  ctx: TenantContext,
  pipelineId: string,
  filters: DealFilters = {},
) {
  const [stages, deals] = await Promise.all([
    ctx.db.pipelineStage.findMany({
      where: { pipelineId, archivedAt: null },
      orderBy: { position: "asc" },
    }),
    ctx.db.deal.findMany({
      where: { AND: [dealWhere(ctx, { ...filters, status: "open" }), { pipelineId }] },
      select: { stageId: true, value: true, currency: true, probability: true },
    }),
  ]);
  const out: StageSummary[] = stages.map((s) => ({
    stageId: s.id,
    name: s.name,
    count: 0,
    totals: {},
    weighted: {},
  }));
  const idx = new Map(out.map((s, i) => [s.stageId, i]));
  const prob = new Map(stages.map((s) => [s.id, s.probability]));
  const D = Prisma.Decimal;
  for (const d of deals) {
    const i = idx.get(d.stageId);
    if (i === undefined) continue;
    const s = out[i];
    s.count += 1;
    s.totals[d.currency] = new D(s.totals[d.currency] ?? 0).plus(d.value).toFixed(2);
    const p = d.probability ?? prob.get(d.stageId) ?? 0;
    s.weighted[d.currency] = new D(s.weighted[d.currency] ?? 0)
      .plus(d.value.mul(p).div(100))
      .toFixed(2);
  }
  return out;
}

export { decimalToString };
