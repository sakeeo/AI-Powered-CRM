import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import { TONE_CLASS } from "@/components/shared/tone";

/** Pil tren. Naik = hijau, turun = merah; selalu disertai panah (bukan hanya warna). */
export function TrendBadge({
  value,
  direction = "up",
  className,
}: {
  value: string;
  direction?: "up" | "down";
  className?: string;
}) {
  const t = TONE_CLASS[direction === "up" ? "green" : "red"];
  const Arrow = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs leading-none font-semibold tabular-nums",
        t.soft,
        t.ink,
        className,
      )}
    >
      <Arrow className="size-3.5" aria-hidden />
      <span className="sr-only">{direction === "up" ? "Naik" : "Turun"} </span>
      {value}
    </span>
  );
}
