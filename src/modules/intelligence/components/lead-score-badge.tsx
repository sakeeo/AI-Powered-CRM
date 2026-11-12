import { ToneBadge } from "@/components/shared/tone-badge";
import {
  LEAD_BAND_LABEL,
  LEAD_BAND_TONE,
  type LeadBand,
  type ScoreFactor,
} from "@/modules/intelligence/lead-score";

/** Badge skor lead (informasi saja). `title` memuat ringkasan faktor agar bisa dibaca saat hover. */
export function LeadScoreBadge({
  score,
  band,
  factors,
}: {
  score: number;
  band: LeadBand;
  factors?: ScoreFactor[];
}) {
  const title = factors?.map((f) => `${f.label}: ${f.points}/${f.max} — ${f.note}`).join("\n");
  return (
    <span title={title} data-testid="lead-score-badge">
      <ToneBadge tone={LEAD_BAND_TONE[band]}>
        {LEAD_BAND_LABEL[band]} · {score}
      </ToneBadge>
    </span>
  );
}
