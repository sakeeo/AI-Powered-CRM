import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

/** Banner hero gradien (maks. 1 per halaman). Konten → HeroStat / HeroButton. */
export function HeroBanner({
  title,
  badge,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  badge?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "shadow-hero relative overflow-hidden rounded-2xl p-[22px] text-white",
        "bg-(image:--gradient-hero)",
        // lingkaran dekoratif
        "before:pointer-events-none before:absolute before:-top-[60px] before:-right-[60px] before:size-[220px] before:rounded-full before:bg-white/[0.09]",
        "after:pointer-events-none after:absolute after:-right-[90px] after:-bottom-[150px] after:size-[240px] after:rounded-full after:border after:border-white/10 after:shadow-[0_0_0_25px_rgb(255_255_255/0.03),0_0_0_55px_rgb(255_255_255/0.025)]",
        className,
      )}
    >
      <div className="relative z-10">
        {actions && (
          <div className="mb-3 flex gap-2 sm:absolute sm:top-0 sm:right-0 sm:mb-0">{actions}</div>
        )}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <h2 className="text-hero font-bold">{title}</h2>
          {badge && (
            <span className="rounded-full border border-white/15 bg-white/15 px-2.5 py-1 text-xs text-white/90">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="mt-1.5 mb-5 text-sm text-white/85">{description}</p>}
        {children && <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>}
      </div>
    </section>
  );
}

export function HeroStat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/15 bg-white/10 px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-white/85">
        <span className="grid size-[27px] place-items-center rounded-[8px] bg-white/15" aria-hidden>
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="text-kpi-sm mt-1.5 font-bold tabular-nums">{value}</p>
      {note && <p className="text-xs text-white/80">{note}</p>}
    </div>
  );
}

/** Tombol outline putih di atas hero. */
export function HeroButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-xs text-white transition-colors hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
