import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { evaluateQuality, type QualityMetrics } from "@/modules/intelligence/quality";

/** Kumpulkan metrik kualitas data org (agregat — tidak membaca isi record). */
export async function getDataQuality(ctx: TenantContext, now = new Date()) {
  assertCan(ctx, "view", "Report");
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [
    leads,
    withContact,
    withSource,
    converted,
    won,
    lost,
    history,
    closedDates,
    acts,
    custC,
    custP,
  ] = await Promise.all([
    ctx.db.lead.count(),
    ctx.db.lead.count({ where: { OR: [{ email: { not: null } }, { phone: { not: null } }] } }),
    ctx.db.lead.count({ where: { sourceId: { not: null } } }),
    ctx.db.lead.count({ where: { convertedAt: { not: null } } }),
    ctx.db.deal.count({ where: { status: "won", deletedAt: null } }),
    ctx.db.deal.count({ where: { status: "lost", deletedAt: null } }),
    ctx.db.deal.count({
      where: { status: { in: ["won", "lost"] }, deletedAt: null, stageHistory: { some: {} } },
    }),
    ctx.db.deal.findMany({
      where: { status: { in: ["won", "lost"] }, deletedAt: null, closedAt: { not: null } },
      select: { closedAt: true },
      take: 20_000,
    }),
    ctx.db.activity.count({ where: { createdAt: { gte: since } } }),
    ctx.db.deal.findMany({
      where: { status: "won", deletedAt: null, companyId: { not: null } },
      distinct: ["companyId"],
      select: { companyId: true },
    }),
    ctx.db.deal.findMany({
      where: { status: "won", deletedAt: null, companyId: null, contactId: { not: null } },
      distinct: ["contactId"],
      select: { contactId: true },
    }),
  ]);
  const months = new Set(closedDates.map((d) => d.closedAt!.toISOString().slice(0, 7)));
  const metrics: QualityMetrics = {
    leads,
    leadsWithContact: withContact,
    leadsWithSource: withSource,
    leadsConverted: converted,
    dealsWon: won,
    dealsLost: lost,
    closedWithHistory: history,
    closedMonths: months.size,
    activities90d: acts,
    customers: custC.length + custP.length,
  };
  return { metrics, readiness: evaluateQuality(metrics) };
}
