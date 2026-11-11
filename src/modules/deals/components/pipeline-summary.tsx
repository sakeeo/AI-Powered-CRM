import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { StageSummary } from "@/modules/deals/server/queries";

/** Ringkasan nilai pipeline per stage (DEAL-14): jumlah deal, total, dan nilai tertimbang. */
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
  const totals = sum("totals");
  const weighted = sum("weighted");
  return (
    <div className="space-y-3">
      <Card className="p-card flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="text-muted-foreground text-xs">Total pipeline (deal terbuka)</p>
          <p className="text-kpi-sm font-bold tabular-nums">
            {Object.keys(totals).length
              ? Object.entries(totals)
                  .map(([c, v]) => formatMoney(v, c))
                  .join(" · ")
              : formatMoney(0, defaultCurrency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Nilai tertimbang probabilitas</p>
          <p className="text-kpi-sm font-bold tabular-nums">
            {Object.keys(weighted).length
              ? Object.entries(weighted)
                  .map(([c, v]) => formatMoney(v, c))
                  .join(" · ")
              : formatMoney(0, defaultCurrency)}
          </p>
        </div>
      </Card>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {stages.map((s) => (
          <Card key={s.stageId} className="p-card min-w-44 flex-1 gap-1">
            <p className="text-muted-foreground truncate text-xs">{s.name}</p>
            <p className="text-lg font-bold tabular-nums">{s.count} deal</p>
            <p className="text-label tabular-nums">
              {Object.keys(s.totals).length
                ? Object.entries(s.totals)
                    .map(([c, v]) => formatMoney(v, c))
                    .join(" · ")
                : "—"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
