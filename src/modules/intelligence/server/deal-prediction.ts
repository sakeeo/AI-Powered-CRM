import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import {
  backtestStageModel,
  predictDeal,
  tally,
  type Backtest,
  type ClosedSample,
  type DealPrediction,
  type StageInfo,
} from "@/modules/intelligence/deal-prediction";
import { getDataQuality } from "@/modules/intelligence/server/quality";

const DAY = 86_400_000;

export type DealPredictionResult =
  | { ready: false; reasons: string[] }
  | { ready: true; prediction: DealPrediction; backtest: Backtest | null };

async function loadModel(ctx: TenantContext, pipelineId: string) {
  const stageRows = await ctx.db.pipelineStage.findMany({
    where: { pipelineId },
    orderBy: { position: "asc" },
  });
  const stages: StageInfo[] = stageRows.map((s) => ({
    id: s.id,
    position: s.position,
    probability: s.probability,
    name: s.name,
  }));
  const pos = new Map(stages.map((s) => [s.id, s.position]));
  const closed = await ctx.db.deal.findMany({
    where: { pipelineId, status: { in: ["won", "lost"] }, deletedAt: null },
    select: {
      status: true,
      stageId: true,
      stageHistory: { select: { fromStageId: true, toStageId: true } },
    },
    take: 5000,
  });
  const samples: ClosedSample[] = closed.map((d) => {
    const ids = [d.stageId, ...d.stageHistory.flatMap((h) => [h.fromStageId, h.toStageId])];
    const maxPos = Math.max(...ids.map((i) => (i ? (pos.get(i) ?? 0) : 0)));
    return { won: d.status === "won", maxPos };
  });
  return { stages, samples };
}

/** Akurasi backtest model untuk satu pipeline (agregat; tidak mengungkap record). */
export async function getPipelineBacktest(ctx: TenantContext, pipelineId: string) {
  assertCan(ctx, "view", "Deal");
  const { stages, samples } = await loadModel(ctx, pipelineId);
  return backtestStageModel(samples, stages);
}

/**
 * Rekomendasi stage & probabilitas untuk satu deal TERBUKA. Hanya membaca: tidak memindahkan stage,
 * tidak mengubah probabilitas deal. Digerbangi kualitas data (`dealPrediction`).
 */
export async function getDealPrediction(
  ctx: TenantContext,
  dealId: string,
  now = new Date(),
): Promise<DealPredictionResult | null> {
  assertCan(ctx, "view", "Deal");
  const deal = await ctx.db.deal.findFirst({
    where: {
      AND: [
        { id: dealId, deletedAt: null },
        scopeWhere(ctx, "view", "Deal") as Prisma.DealWhereInput,
      ],
    },
  });
  if (!deal) throw NotFoundError("Deal");
  if (deal.status !== "open") return null;
  const quality = await getDataQuality(ctx, now);
  if (!quality.readiness.dealPrediction.ready)
    return { ready: false, reasons: quality.readiness.dealPrediction.reasons };

  const { stages, samples } = await loadModel(ctx, deal.pipelineId);
  const stage = stages.find((s) => s.id === deal.stageId);
  if (!stage) return null;
  const active = await ctx.db.pipelineStage.findMany({
    where: { pipelineId: deal.pipelineId, archivedAt: null, position: { gt: stage.position } },
    orderBy: { position: "asc" },
    take: 1,
  });
  const next = active[0] ? (stages.find((s) => s.id === active[0]!.id) ?? null) : null;

  const lastMove = await ctx.db.dealStageHistory.findFirst({
    where: { dealId: deal.id, toStageId: deal.stageId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const stageSince = lastMove?.createdAt ?? deal.createdAt;
  const [acts, sentQuotations] = await Promise.all([
    ctx.db.activity.findMany({
      where: { dealId: deal.id, status: "done" },
      select: { completedAt: true, createdAt: true },
    }),
    ctx.db.quotation.count({ where: { dealId: deal.id, status: { in: ["sent", "accepted"] } } }),
  ]);
  const times = acts.map((a) => (a.completedAt ?? a.createdAt).getTime());
  const lastTouch = Math.max(deal.createdAt.getTime(), deal.updatedAt.getTime(), ...times);
  const prediction = predictDeal(stage, next, tally(samples, stages), {
    daysSinceTouch: Math.max(0, Math.floor((now.getTime() - lastTouch) / DAY)),
    doneSinceStage: times.filter((t) => t >= stageSince.getTime()).length,
    daysInStage: Math.max(0, Math.floor((now.getTime() - stageSince.getTime()) / DAY)),
    daysToClose: deal.expectedCloseDate
      ? Math.ceil((deal.expectedCloseDate.getTime() - now.getTime()) / DAY)
      : null,
    sentQuotations,
  });
  return { ready: true, prediction, backtest: backtestStageModel(samples, stages) };
}
