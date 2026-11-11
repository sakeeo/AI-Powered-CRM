import { ALL_NAV_ITEMS } from "@/components/layout/nav";
import { EmptyState } from "@/components/shared/empty-state";

/** Halaman placeholder sampai modulnya dikerjakan (lihat docs/plans). */
export function PlaceholderPage({ href }: { href: string }) {
  const item = ALL_NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`Menu tidak ditemukan: ${href}`);
  return (
    <EmptyState
      icon={item.icon}
      title={`Belum ada data di ${item.title}`}
      description="Modul ini akan tersedia pada phase pengembangan berikutnya. Lihat docs/PROGRESS.md."
    />
  );
}
