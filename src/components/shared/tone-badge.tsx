import { cn } from "cn";
import { TONE_CLASS, type Tone } from "@/components/shared/tone";

/** Badge status berwarna tint (tone semantik, design-system §2.3). */
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
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        t.soft,
        t.ink,
        className,
      )}
    >
      {children}
    </span>
  );
}
