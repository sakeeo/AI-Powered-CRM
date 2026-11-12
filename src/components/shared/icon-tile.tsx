import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { TONE_CLASS, type Tone } from "@/components/shared/tone";

/** Kotak ikon berwarna tint (metrik 36px, aktivitas 27px). */
export function IconTile({
  icon: Icon,
  tone = "blue",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = TONE_CLASS[tone];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "md"
          ? "size-10 rounded-full [&_svg]:size-[17px]"
          : "size-7 rounded-full [&_svg]:size-3.5",
        t.soft,
        t.ink,
        className,
      )}
    >
      <Icon />
    </span>
  );
}
