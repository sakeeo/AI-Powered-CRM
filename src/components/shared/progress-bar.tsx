import { cn } from "cn";
import { TONE_CLASS, type Tone } from "@/components/shared/tone";

/** Progress 5px: track `muted`, isi tone solid. */
export function ProgressBar({
  value,
  tone = "blue",
  label,
  className,
}: {
  value: number;
  tone?: Tone;
  label: string;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("bg-muted h-[5px] overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-350 ease-out",
          TONE_CLASS[tone].bar,
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
