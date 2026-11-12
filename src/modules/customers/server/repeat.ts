import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { REPEAT_OPPORTUNITY, analyzeRepeat, type RepeatAnalysis } from "@/modules/customers/repeat";

export type RepeatOpportunity = RepeatAnalysis & {
  key: string;
  type: "company" | "contact";
  id: string;
  name: string;
};

/**
 * Customer yang layak di-follow-up untuk pembelian ulang. Hanya data yang boleh dilihat pengguna (scope
 * Deal) dan hanya customer TANPA deal terbuka (yang sedang berjalan tidak perlu dikejar lagi).
 */
export async function listRepeatOpportunities(
  ctx: TenantContext,
  now = new Date(),
  limit = 20,
): Promise<RepeatOpportunity[]> {
  assertCan(ctx, "view", "Customer");
  const scope = scopeWhere(ctx, "view", "Deal") as Prisma.DealWhereInput;
  const [won, open] = await Promise.all([
    ctx.db.deal.findMany({
      where: { AND: [{ status: "won", deletedAt: null, closedAt: { not: null } }, scope] },
      select: { companyId: true, contactId: true, closedAt: true },
      take: 10_000,
    }),
    ctx.db.deal.findMany({
      where: { AND: [{ status: "open", deletedAt: null }, scope] },
      select: { companyId: true, contactId: true },
    }),
  ]);
  const openKeys = new Set(
    open.flatMap((d) => [
      ...(d.companyId ? [`company:${d.companyId}`] : []),
      ...(d.contactId ? [`contact:${d.contactId}`] : []),
    ]),
  );
  const byParty = new Map<string, Date[]>();
  for (const d of won) {
    // Satu deal dihitung pada company-nya bila ada, jika tidak pada contact-nya (selaras dengan daftar customer).
    for (const k of [
      ...(d.companyId ? [`company:${d.companyId}`] : []),
      ...(d.contactId ? [`contact:${d.contactId}`] : []),
    ])
      (byParty.get(k) ?? byParty.set(k, []).get(k)!).push(d.closedAt!);
  }
  const rows: Omit<RepeatOpportunity, "name">[] = [];
  for (const [key, dates] of byParty) {
    if (openKeys.has(key)) continue;
    const a = analyzeRepeat(dates, now);
    if (!a || !REPEAT_OPPORTUNITY.includes(a.status)) continue;
    const [type, id] = key.split(":") as ["company" | "contact", string];
    rows.push({ ...a, key, type, id });
  }
  const urgency = {
    overdue: 0,
    soon: 1,
    one_time_stale: 2,
    scheduled: 3,
    one_time_recent: 4,
  } as const;
  rows.sort((a, b) => urgency[a.status] - urgency[b.status] || b.daysLate - a.daysLate);
  const top = rows.slice(0, limit);
  const [companies, contacts] = await Promise.all([
    ctx.db.company.findMany({
      where: {
        id: { in: top.filter((r) => r.type === "company").map((r) => r.id) },
        deletedAt: null,
      },
      select: { id: true, name: true },
    }),
    ctx.db.contact.findMany({
      where: {
        id: { in: top.filter((r) => r.type === "contact").map((r) => r.id) },
        deletedAt: null,
      },
      select: { id: true, name: true },
    }),
  ]);
  const names = new Map<string, string>([
    ...companies.map((c) => [`company:${c.id}`, c.name] as const),
    ...contacts.map((c) => [`contact:${c.id}`, c.name] as const),
  ]);
  return top.flatMap((r) => (names.has(r.key) ? [{ ...r, name: names.get(r.key)! }] : []));
}
