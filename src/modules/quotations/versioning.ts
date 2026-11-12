import Decimal from "decimal.js";

/** Snapshot isi quotation. Semua angka berupa string desimal (presisi uang terjaga). */
export type SnapshotItem = {
  productId: string | null;
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  lineTotal: string;
};
export type Snapshot = {
  title: string;
  validUntil: string;
  currency: string;
  contactId: string | null;
  companyId: string | null;
  notes: string | null;
  terms: string | null;
  narrative: string | null;
  taxLabel: string;
  taxRate: string;
  taxInclusive: boolean;
  globalDiscountPercent: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  items: SnapshotItem[];
};

export const HEADER_FIELDS: { key: keyof Snapshot; label: string; money?: boolean }[] = [
  { key: "title", label: "Judul" },
  { key: "validUntil", label: "Berlaku sampai" },
  { key: "currency", label: "Mata uang" },
  { key: "globalDiscountPercent", label: "Diskon global (%)" },
  { key: "narrative", label: "Narasi pengantar" },
  { key: "notes", label: "Catatan" },
  { key: "terms", label: "Syarat & ketentuan" },
  { key: "subtotal", label: "Subtotal", money: true },
  { key: "discountTotal", label: "Diskon", money: true },
  { key: "taxTotal", label: "Pajak", money: true },
  { key: "total", label: "Total", money: true },
];
const ITEM_FIELDS: { key: keyof SnapshotItem; label: string }[] = [
  { key: "description", label: "Deskripsi" },
  { key: "quantity", label: "Jumlah" },
  { key: "unitPrice", label: "Harga satuan" },
  { key: "discountPercent", label: "Diskon (%)" },
  { key: "lineTotal", label: "Total baris" },
];

export type FieldChange = { field: string; from: string; to: string };
export type ItemChange =
  | { kind: "added" | "removed"; name: string; lineTotal: string }
  | { kind: "changed"; name: string; changes: FieldChange[] };
export type SnapshotDiff = {
  header: FieldChange[];
  items: ItemChange[];
  /** total(b) − total(a) sebagai string desimal bertanda */
  totalDelta: string;
  identical: boolean;
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const eq = (a: unknown, b: unknown, num: boolean) =>
  num && a != null && b != null && a !== "" && b !== ""
    ? new Decimal(String(a)).eq(String(b))
    : (a ?? null) === (b ?? null);
const NUMERIC = new Set([
  "quantity",
  "unitPrice",
  "discountPercent",
  "lineTotal",
  "subtotal",
  "discountTotal",
  "taxTotal",
  "total",
  "globalDiscountPercent",
]);

/** Kunci pencocokan item antar versi: produk (atau nama) + urutan kemunculan agar item kembar tidak tertukar. */
function keyed(items: SnapshotItem[]) {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const base = it.productId ?? `n:${it.name.trim().toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: `${base}#${n}`, it };
  });
}

/** Perbandingan dua versi: perubahan header, item ditambah/dihapus/diubah, dan selisih total. */
export function diffSnapshots(a: Snapshot, b: Snapshot): SnapshotDiff {
  const header: FieldChange[] = [];
  for (const f of HEADER_FIELDS) {
    const x = a[f.key];
    const y = b[f.key];
    if (!eq(x, y, NUMERIC.has(f.key))) header.push({ field: f.label, from: show(x), to: show(y) });
  }
  const A = new Map(keyed(a.items).map((k) => [k.key, k.it]));
  const B = new Map(keyed(b.items).map((k) => [k.key, k.it]));
  const items: ItemChange[] = [];
  for (const [key, it] of B) {
    const old = A.get(key);
    if (!old) {
      items.push({ kind: "added", name: it.name, lineTotal: it.lineTotal });
      continue;
    }
    const changes: FieldChange[] = [];
    if (old.name !== it.name) changes.push({ field: "Nama", from: old.name, to: it.name });
    for (const f of ITEM_FIELDS) {
      if (!eq(old[f.key], it[f.key], NUMERIC.has(f.key)))
        changes.push({ field: f.label, from: show(old[f.key]), to: show(it[f.key]) });
    }
    if (changes.length) items.push({ kind: "changed", name: it.name, changes });
  }
  for (const [key, it] of A) {
    if (!B.has(key)) items.push({ kind: "removed", name: it.name, lineTotal: it.lineTotal });
  }
  const delta = new Decimal(b.total).minus(a.total);
  return {
    header,
    items,
    totalDelta: delta.toFixed(2),
    identical: header.length === 0 && items.length === 0,
  };
}

/** Bandingkan isi dua snapshot untuk deduplikasi versi (angka dibandingkan sebagai Decimal). */
export const sameSnapshot = (a: Snapshot, b: Snapshot) => diffSnapshots(a, b).identical;
