import type { ReactNode } from "react";

/** Baris judul bagian + aksi (mis. tombol Tambah) di atas konten halaman. */
export function PageActions({
  children,
  title,
  description,
}: {
  children?: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        {title && <h2 className="text-panel-title font-semibold">{title}</h2>}
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
