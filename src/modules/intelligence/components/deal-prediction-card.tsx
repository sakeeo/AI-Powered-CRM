import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealPredictionResult } from "@/modules/intelligence/server/deal-prediction";

const ADVICE_TONE = { advance: "green", stay: "blue", review: "orange" } as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Rekomendasi stage & estimasi probabilitas closing (read-only; keputusan tetap di tangan pengguna). */
export function DealPredictionCard({ result }: { result: DealPredictionResult }) {
  return (
    <Card data-testid="deal-prediction-card">
      <CardHeader>
        <div>
          <CardTitle>Asisten penjualan</CardTitle>
          <CardDescription>
            Estimasi dari riwayat deal tertutup — bukan jaminan. Tidak memindahkan stage atau
            mengubah probabilitas deal; Anda yang memutuskan.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result.ready ? (
          <div
            className="text-muted-foreground space-y-1 text-sm"
            data-testid="prediction-not-ready"
          >
            <p>Data belum memadai untuk prediksi yang bermakna:</p>
            <ul className="list-disc pl-5 text-xs">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl font-semibold tabular-nums" data-testid="prediction-prob">
                {result.prediction.probability}%
              </span>
              <span className="text-muted-foreground text-xs">estimasi peluang closing</span>
              <ToneBadge tone={ADVICE_TONE[result.prediction.advice.action]}>
                {result.prediction.advice.title}
              </ToneBadge>
            </div>
            <p className="text-sm">{result.prediction.advice.reason}</p>
            <ul className="divide-y rounded-lg border text-xs">
              {result.prediction.factors.map((f) => (
                <li key={f.key} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground block">{f.note}</span>
                  </span>
                  <span className="tabular-nums">{f.effect}</span>
                </li>
              ))}
            </ul>
            {result.backtest ? (
              <p className="text-muted-foreground text-xs" data-testid="prediction-accuracy">
                Akurasi model stage (backtest leave-one-out, {result.backtest.closedDeals} deal
                tertutup): {pct(result.backtest.accuracy)} benar · Brier{" "}
                {result.backtest.brier.toFixed(3)} (probabilitas default stage:{" "}
                {pct(result.backtest.baselineAccuracy)} · {result.backtest.baselineBrier.toFixed(3)}
                ). Pengali sinyal aktivitas bersifat heuristik dan tidak ikut di-backtest.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
