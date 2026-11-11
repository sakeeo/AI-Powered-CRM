import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

const GRADIENT = {
  blue: "bg-(image:--gradient-quick-blue)",
  green: "bg-(image:--gradient-quick-green)",
  orange: "bg-(image:--gradient-quick-orange)",
  purple: "bg-(image:--gradient-quick-purple)",
} as const;

/** Tile aksi cepat bergradien. Tautan navigasi (untuk aksi non-navigasi, kirim `onClick` dan `href` kosong tidak didukung — pakai Button). */
export function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  tone = "blue",
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: keyof typeof GRADIENT;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-visible:ring-ring/50 relative block min-h-[88px] overflow-hidden rounded-lg p-3.5 text-left text-white transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "after:pointer-events-none after:absolute after:-top-12 after:-right-10 after:size-[100px] after:rounded-full after:bg-white/[0.08]",
        GRADIENT[tone],
      )}
    >
      <Icon className="mb-2 size-5" aria-hidden />
      <strong className="text-label block font-bold">{title}</strong>
      <small className="text-micro opacity-85">{description}</small>
    </Link>
  );
}
