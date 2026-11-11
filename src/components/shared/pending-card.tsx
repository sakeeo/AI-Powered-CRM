import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import { TONE_CLASS, type Tone } from "@/components/shared/tone";

/** Kartu "perlu tindakan": latar tone soft, ikon + jumlah solid, tombol penuh. */
export function PendingCard({
  tone,
  icon: Icon,
  count,
  title,
  description,
  href,
  actionLabel = "Tinjau sekarang",
}: {
  tone: Extract<Tone, "orange" | "blue" | "red">;
  icon: LucideIcon;
  count: number;
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
}) {
  const t = TONE_CLASS[tone];
  return (
    <div className={cn("rounded-xl border p-4", t.soft, t.border)}>
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className={cn("grid size-[34px] place-items-center rounded-lg shadow-sm", t.solid)}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", t.solid)}>
          {count}
        </span>
      </div>
      <strong className="text-md block font-semibold">{title}</strong>
      <p className="text-muted-foreground text-label mt-1 mb-3">{description}</p>
      <Link
        href={href}
        className={cn(
          "text-label focus-visible:ring-ring/50 flex h-9 w-full items-center justify-center gap-1 rounded-md font-semibold shadow-sm transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:outline-none",
          t.solid,
        )}
      >
        {actionLabel}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
