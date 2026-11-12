import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import {
  median,
  scoreLead,
  type LeadScore,
  type LeadScoreInput,
  type ScoreContext,
  type SourceStat,
} from "@/modules/intelligence/lead-score";

type LeadLike = Omit<LeadScoreInput, "budget"> & { id: string; budget: unknown };

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Konteks skor org-wide (agregat saja: konversi per sumber & median budget — tanpa data per record). */
export async function loadScoreContext(
  ctx: TenantContext,
  now = new Date(),
): Promise<ScoreContext> {
  const [bySource, converted, budgets] = await Promise.all([
    ctx.db.lead.groupBy({
      by: ["sourceId"],
      _count: { _all: true },
      where: { sourceId: { not: null } },
    }),
    ctx.db.lead.groupBy({
      by: ["sourceId"],
      _count: { _all: true },
      where: { sourceId: { not: null }, convertedAt: { not: null } },
    }),
    ctx.db.lead.findMany({
      where: { budget: { gt: 0 }, archivedAt: null },
      select: { budget: true },
      take: 5000,
    }),
  ]);
  const sourceStats = new Map<string, SourceStat>();
  for (const r of bySource)
    if (r.sourceId) sourceStats.set(r.sourceId, { total: r._count._all, converted: 0 });
  for (const r of converted) {
    const s = r.sourceId ? sourceStats.get(r.sourceId) : undefined;
    if (s) s.converted = r._count._all;
  }
  return {
    sourceStats,
    medianBudget: median(budgets.map((b) => Number(b.budget))),
    now,
  };
}

/**
 * Skor untuk sekumpulan lead (mis. satu halaman tabel). Membaca saja — tidak menulis apa pun.
 * Aktivitas dihitung hanya dari lead yang diberikan, jadi biaya mengikuti ukuran halaman.
 */
export async function scoreLeads(
  ctx: TenantContext,
  leads: LeadLike[],
  now = new Date(),
): Promise<Map<string, LeadScore>> {
  assertCan(ctx, "view", "Lead");
  const out = new Map<string, LeadScore>();
  const open = leads.filter((l) => !l.convertedAt && !l.archivedAt);
  if (open.length === 0) return out;
  const [sc, acts] = await Promise.all([
    loadScoreContext(ctx, now),
    ctx.db.activity.findMany({
      where: { leadId: { in: open.map((l) => l.id) }, status: "done" },
      select: { leadId: true, completedAt: true, createdAt: true },
    }),
  ]);
  const stats = new Map<string, { doneCount: number; lastTouchAt: Date | null }>();
  for (const a of acts) {
    const s = stats.get(a.leadId!) ?? { doneCount: 0, lastTouchAt: null };
    s.doneCount += 1;
    const t = a.completedAt ?? a.createdAt;
    if (!s.lastTouchAt || t > s.lastTouchAt) s.lastTouchAt = t;
    stats.set(a.leadId!, s);
  }
  for (const l of open) {
    const r = scoreLead(
      { ...l, budget: num(l.budget) },
      stats.get(l.id) ?? { doneCount: 0, lastTouchAt: null },
      sc,
    );
    if (r) out.set(l.id, r);
  }
  return out;
}

/** Skor satu lead beserta faktor (untuk halaman detail). Menghormati izin view Lead. */
export async function getLeadScore(ctx: TenantContext, leadId: string) {
  assertCan(ctx, "view", "Lead");
  const lead = await ctx.db.lead.findFirst({
    where: { AND: [{ id: leadId }, scopeWhere(ctx, "view", "Lead") as Prisma.LeadWhereInput] },
  });
  if (!lead) return null;
  return (await scoreLeads(ctx, [lead])).get(lead.id) ?? null;
}
