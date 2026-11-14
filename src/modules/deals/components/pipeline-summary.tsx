import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { StageSummary } from "@/modules/deals/server/queries";

/** Class literal (agar terbaca Tailwind): shadow berwarna per panel, berputar mengikuti urutan stage. */
const STAGE_SHADOWS = [
  "shadow-glow-green",
  "shadow-glow-orange",
  "shadow-glow-purple",
  "shadow-glow-red",
  "shadow-glow-blue",
] as const;

function money(values: Record<string, number | string>, fallback: string) {
  const entries = Object.entries(values);
  return entries.length ? entries.map(([c, v]) => formatMoney(v, c)).join(" · ") : fallback;
}

/**
 * Ringkasan nilai pipeline (DEAL-14) dalam satu baris: panel total pipeline (beserta nilai
 * tertimbang probabilitas) diikuti satu panel per stage (jumlah deal + total nilai).
 */
export function PipelineSummary({
  stages,
  defaultCurrency,
}: {
  stages: StageSummary[];
  defaultCurrency: string;
}) {
  const sum = (key: "totals" | "weighted") => {
    const acc: Record<string, number> = {};
    for (const s of stages)
      for (const [cur, v] of Object.entries(s[key])) acc[cur] = (acc[cur] ?? 0) + Number(v);
    return acc;
  };
  const zero = formatMoney(0, defaultCurrency);
  return (
    <div className="grid auto-cols-[minmax(10.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pt-1 pb-3">
      <Card className="shadow-glow-blue card-hover p-card gap-1">
        <p className="text-muted-foreground truncate text-xs">Total pipeline (deal terbuka)</p>
        <p className="text-lg font-bold tabular-nums">{money(sum("totals"), zero)}</p>
        <p className="text-muted-foreground text-xs">Tertimbang probabilitas</p>
        <p className="text-label tabular-nums">{money(sum("weighted"), zero)}</p>
      </Card>
      {stages.map((s, i) => (
        <Card
          key={s.stageId}
          className={`${STAGE_SHADOWS[i % STAGE_SHADOWS.length]} card-hover p-card gap-1`}
        >
          <p className="text-muted-foreground truncate text-xs">{s.name}</p>
          <p className="text-lg font-bold tabular-nums">{s.count} deal</p>
          <p className="text-label tabular-nums">{money(s.totals, "—")}</p>
        </Card>
      ))}
    </div>
  );
}
