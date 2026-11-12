import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { AccuracyCard } from "@/modules/intelligence/components/accuracy-card";
import { ensureDefaultPipeline } from "@/modules/deals/server/pipeline";
import { getPipelineBacktest } from "@/modules/intelligence/server/deal-prediction";
import { AcceptanceCard } from "@/modules/intelligence/components/acceptance-card";
import { ReadinessCard } from "@/modules/intelligence/components/readiness-card";
import { getAcceptanceMetrics } from "@/modules/intelligence/server/followup";
import { getDataQuality } from "@/modules/intelligence/server/quality";

export const metadata: Metadata = { title: "Intelligence" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Report")) return <Forbidden what="halaman Intelligence" />;
  const pipeline = await ensureDefaultPipeline(ctx.db);
  const [quality, acceptance, backtest] = await Promise.all([
    getDataQuality(ctx),
    getAcceptanceMetrics(ctx),
    getPipelineBacktest(ctx, pipeline.id),
  ]);
  return (
    <div className="space-y-4">
      <ReadinessCard quality={quality} />
      <AccuracyCard backtest={backtest} />
      <AcceptanceCard metrics={acceptance} />
    </div>
  );
}
