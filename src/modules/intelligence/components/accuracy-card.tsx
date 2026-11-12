import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Backtest } from "@/modules/intelligence/deal-prediction";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Akurasi terukur model prediksi stage (backtest leave-one-out). */
export function AccuracyCard({ backtest }: { backtest: Backtest | null }) {
  return (
    <Card data-testid="accuracy-card">
      <CardHeader>
        <div>
          <CardTitle>Akurasi prediksi deal</CardTitle>
          <CardDescription>
            Backtest leave-one-out atas deal tertutup di pipeline default. Metodologi & batasan:
            docs/intelligence.md.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!backtest ? (
          <p className="text-muted-foreground text-sm">Belum ada deal tertutup untuk diukur.</p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs">Deal tertutup</dt>
              <dd className="font-semibold tabular-nums">{backtest.closedDeals}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Akurasi model</dt>
              <dd className="font-semibold tabular-nums">{pct(backtest.accuracy)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Brier model</dt>
              <dd className="font-semibold tabular-nums">{backtest.brier.toFixed(3)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Pembanding (default stage)</dt>
              <dd className="font-semibold tabular-nums">
                {pct(backtest.baselineAccuracy)} · {backtest.baselineBrier.toFixed(3)}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
