import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { tally, type StageInfo } from "@/modules/intelligence/deal-prediction";
import {
  HORIZON_MONTHS,
  backtestForecast,
  bucketFor,
  monthIndex,
  monthLabel,
  samplesOf,
  simulate,
  stageProbability,
  type FDeal,
  type ForecastBacktest,
  type Range,
} from "@/modules/intelligence/forecast";
import { getDataQuality } from "@/modules/intelligence/server/quality";
import { getOrganization } from "@/modules/organizations/server/queries";

export type ForecastResult =
  | { ready: false; reasons: string[] }
  | {
      ready: true;
      currency: string;
      months: ({ month: string; deals: number } & Range)[];
      total: Range & { deals: number };
      excluded: { noDate: number; beyondHorizon: number; otherCurrency: number };
      backtest: ForecastBacktest;
      trials: number;
    };

/**
 * Forecast probabilistik untuk deal terbuka milik pengguna (mengikuti izin: rep → miliknya; manager+ → semua).
 * Hanya membaca. Digerbangi kualitas data (`forecast`).
 */
export async function getForecast(ctx: TenantContext, now = new Date()): Promise<ForecastResult> {
  assertCan(ctx, "view", "Report");
  assertCan(ctx, "view", "Deal");
  const quality = await getDataQuality(ctx, now);
  if (!quality.readiness.forecast.ready)
    return { ready: false, reasons: quality.readiness.forecast.reasons };

  const { defaultCurrency } = await getOrganization(ctx);
  const scope = scopeWhere(ctx, "view", "Deal") as Prisma.DealWhereInput;
  const pipeline = await ctx.db.pipeline.findFirst({
    where: { isDefault: true, archivedAt: null },
  });
  const pipelineId = pipeline?.id;
  const stageRows = await ctx.db.pipelineStage.findMany({
    where: pipelineId ? { pipelineId } : {},
    orderBy: { position: "asc" },
  });
  const stages: StageInfo[] = stageRows.map((s) => ({
    id: s.id,
    position: s.position,
    probability: s.probability,
    name: s.name,
  }));
  const select = {
    id: true,
    value: true,
    currency: true,
    status: true,
    createdAt: true,
    closedAt: true,
    expectedCloseDate: true,
    stageId: true,
    stageHistory: { select: { fromStageId: true, toStageId: true, createdAt: true } },
  } as const;
  // Latih pada SEMUA deal tertutup org (agregat); perkiraan memakai deal dalam izin pengguna.
  const [allClosed, mine] = await Promise.all([
    ctx.db.deal.findMany({
      where: {
        deletedAt: null,
        status: { in: ["won", "lost"] },
        ...(pipelineId ? { pipelineId } : {}),
      },
      select,
      take: 10_000,
    }),
    ctx.db.deal.findMany({
      where: { AND: [{ deletedAt: null, ...(pipelineId ? { pipelineId } : {}) }, scope] },
      select,
      take: 10_000,
    }),
  ]);
  const toF = (d: (typeof mine)[number]): FDeal => ({
    id: d.id,
    value: Number(d.value),
    createdAt: d.createdAt,
    closedAt: d.closedAt,
    status: d.status as FDeal["status"],
    expectedClose: d.expectedCloseDate,
    stageId: d.stageId,
    history: d.stageHistory,
  });
  const t = tally(samplesOf(allClosed.map(toF), stages), stages);

  const open = mine.filter((d) => d.status === "open");
  const excluded = { noDate: 0, beyondHorizon: 0, otherCurrency: 0 };
  const inHorizon: { p: number; value: number; bucket: number }[] = [];
  for (const d of open) {
    if (d.currency !== defaultCurrency) {
      excluded.otherCurrency++;
      continue;
    }
    const bucket = bucketFor(d.expectedCloseDate, now);
    if (bucket === null) {
      if (d.expectedCloseDate) excluded.beyondHorizon++;
      else excluded.noDate++;
      continue;
    }
    inHorizon.push({ p: stageProbability(d.stageId, stages, t), value: Number(d.value), bucket });
  }
  const sim = simulate(inHorizon, HORIZON_MONTHS);
  const base = monthIndex(now);
  const months = sim.buckets.map((r, i) => ({
    month: monthLabel(base + i),
    deals: inHorizon.filter((d) => d.bucket === i).length,
    ...r,
  }));
  // Backtest: pelatihan dari semua deal tertutup org; kohort yang dievaluasi hanya deal dalam izin pengguna.
  const union = new Map([...allClosed, ...mine].map((d) => [d.id, d]));
  const backtest = backtestForecast(
    [...union.values()].filter((d) => d.currency === defaultCurrency).map(toF),
    stages,
    now,
    6,
    5,
    new Set(mine.map((d) => d.id)),
  );
  return {
    ready: true,
    currency: defaultCurrency,
    months,
    total: { ...sim.total, deals: inHorizon.length },
    excluded,
    backtest,
    trials: 2000,
  };
}
