import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import type { ListParams } from "@/lib/list-params";
import type { PartyType } from "@/modules/customers/schemas";
import { matchesRules, segmentRulesSchema } from "@/modules/customers/segment-rules";
import { getOrganization } from "@/modules/organizations/server/queries";

type DealWhere = Prisma.DealWhereInput;

export type CustomerRow = {
  key: string;
  type: PartyType;
  id: string;
  name: string;
  wonCount: number;
  /** total nilai deal Won per mata uang (string desimal) — dihitung kode */
  totals: Record<string, string>;
  lastWonAt: Date | null;
  segments: { id: string; name: string }[];
};

const wonWhere = (ctx: TenantContext): DealWhere => ({
  AND: [{ status: "won", deletedAt: null }, scopeWhere(ctx, "view", "Deal") as DealWhere],
});

/**
 * Customer = contact/company dengan ≥1 deal Won (docs/decisions.md #11). Diturunkan dari data deal
 * pada setiap query — tidak ada tabel customer yang harus disinkronkan, jadi status berubah otomatis
 * ketika deal menjadi Won (atau dibuka kembali/dihapus). Segmen statis dari tabel anggota; segmen
 * dinamis (plan 2.6) dievaluasi dari aturan setiap kali (tanpa salinan keanggotaan yang bisa basi).
 */
export async function loadCustomerRows(
  ctx: TenantContext,
  type?: string,
  now = new Date(),
): Promise<CustomerRow[]> {
  assertCan(ctx, "view", "Customer");
  const [byCompany, byContact] = await Promise.all([
    type === "contact"
      ? []
      : ctx.db.deal.groupBy({
          by: ["companyId", "currency"],
          where: { AND: [wonWhere(ctx), { companyId: { not: null } }] },
          _sum: { value: true },
          _count: { _all: true },
          _max: { closedAt: true },
        }),
    type === "company"
      ? []
      : ctx.db.deal.groupBy({
          by: ["contactId", "currency"],
          where: { AND: [wonWhere(ctx), { contactId: { not: null } }] },
          _sum: { value: true },
          _count: { _all: true },
          _max: { closedAt: true },
        }),
  ]);

  const map = new Map<string, CustomerRow>();
  const add = (
    t: PartyType,
    id: string | null,
    cur: string,
    sum: Prisma.Decimal | null,
    count: number,
    last: Date | null,
  ) => {
    if (!id) return;
    const key = `${t}:${id}`;
    const row = map.get(key) ?? {
      key,
      type: t,
      id,
      name: "",
      wonCount: 0,
      totals: {},
      lastWonAt: null,
      segments: [],
    };
    row.wonCount += count;
    row.totals[cur] = new Decimal(row.totals[cur] ?? 0).plus(sum?.toString() ?? 0).toFixed(2);
    if (last && (!row.lastWonAt || last > row.lastWonAt)) row.lastWonAt = last;
    map.set(key, row);
  };
  for (const r of byCompany)
    add("company", r.companyId, r.currency, r._sum.value, r._count._all, r._max.closedAt);
  for (const r of byContact)
    add("contact", r.contactId, r.currency, r._sum.value, r._count._all, r._max.closedAt);

  const companyIds = [...map.values()].filter((r) => r.type === "company").map((r) => r.id);
  const contactIds = [...map.values()].filter((r) => r.type === "contact").map((r) => r.id);
  const [companies, contacts, members, dynamic] = await Promise.all([
    ctx.db.company.findMany({
      where: { id: { in: companyIds }, deletedAt: null },
      select: { id: true, name: true },
    }),
    ctx.db.contact.findMany({
      where: { id: { in: contactIds }, deletedAt: null },
      select: { id: true, name: true },
    }),
    ctx.db.customerSegmentMember.findMany({
      where: { OR: [{ companyId: { in: companyIds } }, { contactId: { in: contactIds } }] },
      include: { segment: { select: { id: true, name: true } } },
    }),
    ctx.db.customerSegment.findMany({ where: { kind: "dynamic" } }),
  ]);
  for (const c of companies) map.get(`company:${c.id}`)!.name = c.name;
  for (const c of contacts) map.get(`contact:${c.id}`)!.name = c.name;
  for (const m of members) {
    const key = m.companyId ? `company:${m.companyId}` : `contact:${m.contactId}`;
    map.get(key)?.segments.push(m.segment);
  }

  if (dynamic.length) {
    const parsed = dynamic.flatMap((d) => {
      const r = segmentRulesSchema.safeParse(d.rules);
      return r.success ? [{ id: d.id, name: d.name, rules: r.data }] : [];
    });
    const needTags = parsed.some((d) => d.rules.tagIds?.length);
    const tagMap = new Map<string, Set<string>>();
    if (needTags) {
      const links = await ctx.db.taggable.findMany({
        where: {
          OR: [
            { entityType: "company", entityId: { in: companyIds } },
            { entityType: "contact", entityId: { in: contactIds } },
          ],
        },
        select: { entityType: true, entityId: true, tagId: true },
      });
      for (const l of links) {
        const k = `${l.entityType}:${l.entityId}`;
        (tagMap.get(k) ?? tagMap.set(k, new Set()).get(k)!).add(l.tagId);
      }
    }
    const { defaultCurrency } = await getOrganization(ctx);
    for (const row of map.values()) {
      const subject = { ...row, tagIds: tagMap.get(row.key) ?? new Set<string>() };
      for (const d of parsed)
        if (matchesRules(subject, d.rules, { defaultCurrency, now }))
          row.segments.push({ id: d.id, name: d.name });
    }
  }
  return [...map.values()].filter((r) => r.name);
}

export async function listCustomers(
  ctx: TenantContext,
  params: ListParams,
  filters: { type?: string; segmentId?: string } = {},
) {
  const all = await loadCustomerRows(ctx, filters.type);
  const q = params.q?.toLowerCase();
  let rows = all.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q)) &&
      (!filters.segmentId || r.segments.some((s) => s.id === filters.segmentId)),
  );
  const dir = params.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (params.sort === "name") return a.name.localeCompare(b.name) * dir;
    if (params.sort === "wonCount") return (a.wonCount - b.wonCount) * dir;
    return ((a.lastWonAt?.getTime() ?? 0) - (b.lastWonAt?.getTime() ?? 0)) * dir;
  });
  const total = rows.length;
  rows = rows.slice(params.skip, params.skip + params.take);
  return { total, page: params.page, pageSize: params.pageSize, rows };
}

export function listSegments(ctx: TenantContext) {
  assertCan(ctx, "view", "Customer");
  return ctx.db.customerSegment.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });
}

/** Segmen dinamis lengkap dengan aturan (untuk panel pengelolaan). */
export async function listDynamicSegments(ctx: TenantContext) {
  assertCan(ctx, "view", "Customer");
  const rows = await ctx.db.customerSegment.findMany({
    where: { kind: "dynamic" },
    orderBy: { name: "asc" },
  });
  return rows.flatMap((r) => {
    const p = segmentRulesSchema.safeParse(r.rules);
    return p.success ? [{ id: r.id, name: r.name, rules: p.data }] : [];
  });
}

const partyKey = (type: PartyType, id: string) =>
  type === "company" ? { companyId: id } : { contactId: id };

/** Fakta Customer 360 — semua angka dihitung kode (Decimal), dipakai UI dan briefing AI. */
export async function getCustomer360(ctx: TenantContext, type: PartyType, id: string) {
  assertCan(ctx, "view", "Customer");
  const party =
    type === "company"
      ? await ctx.db.company.findFirst({ where: { id, deletedAt: null } })
      : await ctx.db.contact.findFirst({ where: { id, deletedAt: null } });
  if (!party) throw NotFoundError("Customer");
  const link = partyKey(type, id);
  const scope = scopeWhere(ctx, "view", "Deal") as DealWhere;
  const deals = await ctx.db.deal.findMany({
    where: { AND: [{ deletedAt: null }, scope, link] },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { stage: { select: { name: true } } },
  });
  const won = deals.filter((d) => d.status === "won");
  if (won.length === 0) throw NotFoundError("Customer"); // bukan customer (belum ada deal Won)

  const totals: Record<string, string> = {};
  for (const d of won)
    totals[d.currency] = new Decimal(totals[d.currency] ?? 0).plus(d.value.toString()).toFixed(2);
  const lastWonAt = won.reduce<Date | null>(
    (m, d) => (d.closedAt && (!m || d.closedAt > m) ? d.closedAt : m),
    null,
  );

  const [quotations, feedback, segments] = await Promise.all([
    ctx.db.quotation.findMany({
      where: {
        AND: [
          { deletedAt: null },
          scopeWhere(ctx, "view", "Quotation") as Prisma.QuotationWhereInput,
          link,
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        total: true,
        currency: true,
        validUntil: true,
      },
    }),
    ctx.db.feedback.findMany({ where: link, orderBy: { createdAt: "desc" }, take: 50 }),
    ctx.db.customerSegmentMember.findMany({
      where: link,
      include: { segment: { select: { id: true, name: true } } },
    }),
  ]);
  const staticIds = new Set(segments.map((m) => m.segment.id));
  const self = (await loadCustomerRows(ctx, type)).find((r) => r.key === `${type}:${id}`);
  const dynamicSegments = (self?.segments ?? []).filter((s) => !staticIds.has(s.id));
  return {
    type,
    id,
    name: party.name,
    partyEmail: party.email,
    partyPhone: party.phone,
    wonCount: won.length,
    totals,
    lastWonAt,
    deals: deals.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      stage: d.stage.name,
      value: d.value.toFixed(2),
      currency: d.currency,
      closedAt: d.closedAt,
    })),
    quotations: quotations.map((x) => ({
      ...x,
      total: x.total.toFixed(2),
      validUntil: x.validUntil.toISOString().slice(0, 10),
    })),
    feedback,
    segments: segments.map((m) => m.segment),
    /** Segmen dinamis yang saat ini mencakup customer ini (dihitung dari aturan; tidak dapat dilepas manual) */
    dynamicSegments,
  };
}
export type Customer360 = Awaited<ReturnType<typeof getCustomer360>>;
