"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { addDealProduct, removeDealProduct } from "@/modules/products/server/actions";

export type DealItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string;
  currency: string;
};
export type ProductOption = { id: string; name: string; price: string; currency: string };

/** Produk acuan pada deal (DEAL-13). Total hanya informasi — tidak mengubah nilai deal otomatis. */
export function DealProductsCard({
  dealId,
  items,
  products,
  canEdit,
}: {
  dealId: string;
  items: DealItem[];
  products: ProductOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [pending, start] = useTransition();
  const selected = products.find((p) => p.id === productId);

  const totals: Record<string, number> = {};
  for (const i of items)
    totals[i.currency] = (totals[i.currency] ?? 0) + Number(i.unitPrice) * i.quantity;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-xs">Belum ada produk pada deal ini.</p>
        ) : (
          <>
            <ul className="divide-border divide-y text-sm" data-testid="deal-products">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {i.quantity} × {formatMoney(i.unitPrice, i.currency)}
                  </span>
                  <span className="w-32 text-right font-medium tabular-nums">
                    {formatMoney(i.quantity * Number(i.unitPrice), i.currency)}
                  </span>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Hapus ${i.name}`}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await removeDealProduct({ id: i.id });
                          if (!res.ok) toast.error(res.error);
                          else router.refresh();
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold tabular-nums">
              Total:{" "}
              {Object.entries(totals)
                .map(([c, v]) => formatMoney(v, c))
                .join(" · ")}
            </p>
          </>
        )}
        {canEdit && (
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_5rem_9rem_auto]">
            <SelectField
              id="deal-product"
              value={productId}
              onChange={(v) => {
                setProductId(v);
                setPrice("");
              }}
              placeholder="Pilih produk…"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} — ${formatMoney(p.price, p.currency)}`,
              }))}
            />
            <Input
              aria-label="Jumlah"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <Input
              aria-label="Harga satuan"
              inputMode="decimal"
              placeholder={selected ? selected.price : "Harga katalog"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Button
              disabled={pending || !productId}
              onClick={() =>
                start(async () => {
                  const res = await addDealProduct({
                    dealId,
                    productId,
                    quantity: Number(qty),
                    unitPrice: price || undefined,
                  });
                  if (!res.ok) return void toast.error(res.fieldErrors?.quantity ?? res.error);
                  toast.success("Produk ditambahkan");
                  setProductId("");
                  setQty("1");
                  setPrice("");
                  router.refresh();
                })
              }
            >
              Tambah
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
