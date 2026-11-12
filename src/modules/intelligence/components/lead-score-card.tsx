import { ProgressBar } from "@/components/shared/progress-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadScoreBadge } from "@/modules/intelligence/components/lead-score-badge";
import { LEAD_BAND_TONE, LEAD_SCORE_MAX, type LeadScore } from "@/modules/intelligence/lead-score";

/** Rincian skor lead per faktor: transparan, tanpa tindakan otomatis. */
export function LeadScoreCard({ result }: { result: LeadScore }) {
  return (
    <Card data-testid="lead-score-card">
      <CardHeader>
        <div>
          <CardTitle>Skor lead</CardTitle>
          <CardDescription>
            Perkiraan seberapa siap lead ini ditindaklanjuti, dari data lead & riwayat aktivitas.
            Hanya informasi — tidak mengubah status atau penugasan.
          </CardDescription>
        </div>
        <LeadScoreBadge score={result.score} band={result.band} />
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {result.factors.map((f) => (
            <li key={f.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {f.points}/{f.max}
                </span>
              </div>
              <ProgressBar
                value={(f.points / f.max) * 100}
                tone={LEAD_BAND_TONE[result.band] === "red" ? "red" : "blue"}
                label={f.label}
              />
              <p className="text-muted-foreground text-xs">{f.note}</p>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Total {result.score} dari {LEAD_SCORE_MAX}. Hot ≥ 70, Warm 40–69, Cold &lt; 40.
        </p>
      </CardContent>
    </Card>
  );
}
