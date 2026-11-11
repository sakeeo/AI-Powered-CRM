import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

/** Ditampilkan saat pengguna membuka halaman yang tidak diizinkan role-nya. */
export function Forbidden({ what }: { what: string }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Akses ditolak"
      description={`Role Anda tidak memiliki izin untuk melihat ${what}. Hubungi Owner atau Admin organisasi.`}
    />
  );
}
