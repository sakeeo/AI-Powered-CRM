import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * Tombol aksi per item (baris/daftar): ikon + label di layar lebar (≥ lg); di mobile/tablet hanya ikon
 * (bulat 40px). Label tetap ada untuk pembaca layar (`sr-only`) dan sebagai tooltip (`title`).
 * Gunakan HANYA untuk aksi per item; tombol aksi halaman/form tetap `Button` biasa.
 */
export function RowAction({
  icon: Icon,
  label,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children" | "asChild"> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Button
      title={label}
      {...props}
      className={cn("max-lg:size-10 max-lg:rounded-full max-lg:px-0", className)}
    >
      <Icon />
      <span className="max-lg:sr-only">{label}</span>
    </Button>
  );
}
