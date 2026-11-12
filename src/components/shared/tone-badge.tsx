import { cn } from "cn";
import { TONE_CLASS, type Tone } from "@/components/shared/tone";

/** Badge status berwarna tint (tone semantik, design-system §2.1 / §5). */
export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-3xl px-3 text-xs font-semibold whitespace-nowrap",
        t.soft,
        t.ink,
        className,
      )}
    >
      {children}
    </span>
  );
}
