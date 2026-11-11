"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Package, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { DeleteEntityButton } from "@/components/shared/delete-entity-button";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PageActions } from "@/components/shared/page-actions";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { ProductForm } from "@/modules/products/components/product-form";
import type { ProductInput } from "@/modules/products/schemas";
import { deleteProduct, setProductActive } from "@/modules/products/server/actions";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: string;
  currency: string;
  isActive: boolean;
  category: { id: string; name: string } | null;
};

export function ProductsTable({
  table,
  categories,
  defaultCurrency,
}: {
  table: Omit<DataTableProps<ProductRow>, "columns" | "empty" | "toolbar">;
  categories: { id: string; name: string }[];
  defaultCurrency: string;
}) {
  const can = useCan();
  const router = useRouter();
  const [sheet, setSheet] = useState<{ row?: ProductRow } | null>(null);
  const [pending, start] = useTransition();
  const canWrite = can("update", "Product");
  const names = categories.map((c) => c.name);

  const columns: ColumnDef<ProductRow, unknown>[] = [
    { header: "Produk", accessorKey: "name", meta: { sortKey: "name" } },
    { header: "SKU", id: "sku", cell: (c) => c.row.original.sku ?? "—" },
    { header: "Kategori", id: "category", cell: (c) => c.row.original.category?.name ?? "—" },
    {
      header: "Harga",
      accessorKey: "price",
      meta: { sortKey: "price", className: "text-right tabular-nums" },
      cell: (c) => formatMoney(c.row.original.price, c.row.original.currency),
    },
    {
      header: "Status",
      id: "status",
      cell: (c) => (
        <ToneBadge tone={c.row.original.isActive ? "green" : "orange"}>
          {c.row.original.isActive ? "Aktif" : "Nonaktif"}
        </ToneBadge>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "",
            id: "actions",
            cell: (c) => {
              const r = c.row.original;
              return (
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Ubah ${r.name}`}
                    onClick={() => setSheet({ row: r })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setProductActive({ id: r.id, isActive: !r.isActive });
                        if (!res.ok) toast.error(res.error);
                        else router.refresh();
                      })
                    }
                  >
                    {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  {can("delete", "Product") && (
                    <DeleteEntityButton
                      action={deleteProduct}
                      id={r.id}
                      entity="Produk"
                      name={r.name}
                      redirectTo="/products"
                    />
                  )}
                </div>
              );
            },
          } as ColumnDef<ProductRow, unknown>,
        ]
      : []),
  ];

  const defaults = (r?: ProductRow): Partial<ProductInput> | undefined =>
    r && {
      name: r.name,
      sku: r.sku ?? "",
      description: r.description ?? "",
      categoryName: r.category?.name ?? "",
      price: r.price,
      currency: r.currency as ProductInput["currency"],
      isActive: r.isActive,
    };

  return (
    <div className="space-y-4">
      <PageActions>
        {can("create", "Product") && (
          <Button onClick={() => setSheet({})}>
            <Plus /> Tambah produk
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={columns}
        searchPlaceholder="Cari nama, SKU, deskripsi…"
        toolbar={
          <>
            <UrlFilterSelect
              param="status"
              label="Filter status"
              allLabel="Semua status"
              options={[
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
            <UrlFilterSelect
              param="category"
              label="Filter kategori"
              allLabel="Semua kategori"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </>
        }
        empty={
          <EmptyState
            icon={Package}
            title="Belum ada produk"
            description="Tambahkan produk atau layanan untuk dipakai pada deal dan quotation."
          />
        }
      />
      <EntitySheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        title={sheet?.row ? "Ubah produk" : "Produk baru"}
      >
        {sheet && (
          <ProductForm
            productId={sheet.row?.id}
            defaults={defaults(sheet.row)}
            categories={names}
            defaultCurrency={defaultCurrency}
            onDone={() => {
              setSheet(null);
              router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
