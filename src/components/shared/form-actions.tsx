import type { ReactNode } from "react";
import { DialogFooter } from "@/components/ui/dialog";

/**
 * Baris tombol aksi form di modal (Simpan, dsb.). Taruh sebagai anak terakhir <form>;
 * menempel (sticky) di bawah modal sehingga selalu terlihat saat body di-scroll.
 */
export function FormActions({ className, children }: { className?: string; children: ReactNode }) {
  return <DialogFooter className={className}>{children}</DialogFooter>;
}
