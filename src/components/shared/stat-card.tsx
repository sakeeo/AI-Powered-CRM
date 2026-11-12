import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/shared/icon-tile";
import { ProgressBar } from "@/components/shared/progress-bar";
import type { Tone } from "@/components/shared/tone";
import { TrendBadge } from "@/components/shared/trend-badge";

/** Kartu metrik/KPI (template Spike: ikon bulat tint + angka 22px): ikon + tren, angka besar, label, progress, pembanding. */
export function StatCard({
  icon,
  tone = "blue",
  value,
  label,
  hint,
  trend,
  progress,
  previous,
}: {
  icon: LucideIcon;
  tone?: Tone;
  value: string;
  label: string;
  hint?: string;
  trend?: { value: string; direction?: "up" | "down" };
  progress?: number;
  previous?: { label: string; value: string };
}) {
  return (
    <Card className="p-card">
      <div className="flex items-center justify-between">
        <IconTile icon={icon} tone={tone} />
        {trend && <TrendBadge value={trend.value} direction={trend.direction} />}
      </div>
      <p className="mt-3 text-[22px] font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
      {hint && <p className="text-muted-foreground/80 mt-0.5 text-xs">{hint}</p>}
      {progress !== undefined && (
        <>
          <div className="text-muted-foreground mt-3 mb-1.5 flex justify-between text-xs">
            <span>Progress</span>
            <b className="font-semibold tabular-nums">{progress}%</b>
          </div>
          <ProgressBar value={progress} tone={tone} label={`Progress ${label}`} />
        </>
      )}
      {previous && (
        <div className="text-muted-foreground text-xs mt-2 flex justify-between">
          <span>{previous.label}</span>
          <b className="font-semibold tabular-nums">{previous.value}</b>
        </div>
      )}
    </Card>
  );
}
