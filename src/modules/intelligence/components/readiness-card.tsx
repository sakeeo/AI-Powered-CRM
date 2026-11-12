import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeatureKey } from "@/modules/intelligence/quality";
import type { getDataQuality } from "@/modules/intelligence/server/quality";

const LABEL: Record<FeatureKey, string> = {
  leadScoring: "Skor lead",
  dealPrediction: "Prediksi & saran deal",
  forecast: "Forecast penjualan",
  anomaly: "Deteksi anomali",
};

/** Kesiapan fitur prediktif berdasarkan metrik kualitas data (Phase 3 exit criteria). */
export function ReadinessCard({
  quality,
}: {
  quality: Awaited<ReturnType<typeof getDataQuality>>;
}) {
  const m = quality.metrics;
  const closed = m.dealsWon + m.dealsLost;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <Card data-testid="readiness-card">
      <CardHeader>
        <div>
          <CardTitle>Kualitas data & kesiapan fitur</CardTitle>
          <CardDescription>
            Fitur prediktif aktif hanya bila data memadai; bila belum, alasannya ditampilkan.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Lead", String(m.leads)],
            ["Lead berkontak", pct(m.leadsWithContact, m.leads)],
            ["Lead bersumber", pct(m.leadsWithSource, m.leads)],
            ["Deal tertutup", `${closed} (${m.dealsWon} Won / ${m.dealsLost} Lost)`],
            ["Bulan riwayat", String(m.closedMonths)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground text-xs">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="divide-y rounded-lg border text-sm">
          {(Object.keys(LABEL) as FeatureKey[]).map((k) => {
            const r = quality.readiness[k];
            return (
              <li key={k} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                <div>
                  <p className="font-medium">{LABEL[k]}</p>
                  {r.reasons.map((x) => (
                    <p key={x} className="text-muted-foreground text-xs">
                      {x}
                    </p>
                  ))}
                </div>
                <ToneBadge tone={r.ready ? "green" : "orange"}>
                  {r.ready ? "Siap" : "Belum memadai"}
                </ToneBadge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
