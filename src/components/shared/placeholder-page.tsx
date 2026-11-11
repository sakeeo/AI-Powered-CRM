import { ALL_NAV_ITEMS } from "@/components/layout/nav";
import { EmptyState } from "@/components/shared/empty-state";

/** Halaman placeholder sampai modulnya dikerjakan (lihat docs/plans). */
export function PlaceholderPage({ href }: { href: string }) {
  const item = ALL_NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`Menu tidak ditemukan: ${href}`);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{item.title}</h1>
        <p className="text-muted-foreground text-sm">{item.description}</p>
      </div>
      <EmptyState
        icon={item.icon}
        title={`Belum ada data di ${item.title}`}
        description="Modul ini akan tersedia pada phase pengembangan berikutnya. Lihat docs/PROGRESS.md."
      />
    </div>
  );
}
