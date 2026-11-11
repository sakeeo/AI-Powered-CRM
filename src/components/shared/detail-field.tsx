import type { ReactNode } from "react";

/** Pasangan label/nilai untuk kartu detail. Nilai kosong ditampilkan "—". */
export function DetailField({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-sm">{children || "—"}</dd>
    </div>
  );
}
