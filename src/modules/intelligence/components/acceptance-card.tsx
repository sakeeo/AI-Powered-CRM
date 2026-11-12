import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { getAcceptanceMetrics } from "@/modules/intelligence/server/followup";

/** Metrik AI Draft Acceptance Rate untuk rekomendasi follow-up. */
export function AcceptanceCard({
  metrics,
}: {
  metrics: Awaited<ReturnType<typeof getAcceptanceMetrics>>;
}) {
  return (
    <Card data-testid="acceptance-card">
      <CardHeader>
        <div>
          <CardTitle>Penerimaan rekomendasi follow-up</CardTitle>
          <CardDescription>
            AI Draft Acceptance Rate — {metrics.days} hari terakhir (diterima ÷ diterima + ditolak).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[22px] font-semibold tabular-nums" data-testid="acceptance-rate">
          {metrics.rate === null ? "—" : `${Math.round(metrics.rate * 100)}%`}
        </p>
        <p className="text-muted-foreground text-xs">
          {metrics.accepted} diterima · {metrics.rejected} ditolak
          {metrics.rate === null ? " — belum ada umpan balik" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
