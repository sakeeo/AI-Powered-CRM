import { describe, expect, it } from "vitest";
import { canDecide, requiresApproval } from "@/modules/quotations/approval";
import { diffSnapshots, type Snapshot, type SnapshotItem } from "@/modules/quotations/versioning";
import { analyzeRepeat } from "@/modules/customers/repeat";

const item = (over: Partial<SnapshotItem> = {}): SnapshotItem => ({
  productId: null,
  name: "Lisensi",
  description: null,
  quantity: "1.00",
  unitPrice: "1000.00",
  discountPercent: "0.00",
  lineTotal: "1000.00",
  ...over,
});
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  title: "Penawaran",
  validUntil: "2026-12-31",
  currency: "IDR",
  contactId: null,
  companyId: null,
  notes: null,
  terms: null,
  narrative: null,
  taxLabel: "PPN",
  taxRate: "11.00",
  taxInclusive: false,
  globalDiscountPercent: "0.00",
  subtotal: "1000.00",
  discountTotal: "0.00",
  taxTotal: "110.00",
  total: "1110.00",
  items: [item()],
  ...over,
});

describe("diffSnapshots", () => {
  it("identik bila isi sama (angka dibandingkan sebagai Decimal)", () => {
    const d = diffSnapshots(snap(), snap({ items: [item({ quantity: "1" })], total: "1110" }));
    expect(d.identical).toBe(true);
    expect(d.totalDelta).toBe("0.00");
  });
  it("mendeteksi header, item diubah/ditambah/dihapus, dan selisih total", () => {
    const a = snap({
      items: [item(), item({ name: "Training", unitPrice: "500.00", lineTotal: "500.00" })],
    });
    const b = snap({
      title: "Penawaran Revisi",
      total: "2220.00",
      items: [
        item({ quantity: "2.00", lineTotal: "2000.00" }),
        item({ name: "Support", lineTotal: "300.00", unitPrice: "300.00" }),
      ],
    });
    const d = diffSnapshots(a, b);
    expect(d.header.map((h) => h.field)).toEqual(["Judul", "Total"]);
    expect(d.totalDelta).toBe("1110.00");
    expect(d.items).toContainEqual({
      kind: "changed",
      name: "Lisensi",
      changes: [
        { field: "Jumlah", from: "1.00", to: "2.00" },
        { field: "Total baris", from: "1000.00", to: "2000.00" },
      ],
    });
    expect(d.items).toContainEqual({ kind: "added", name: "Support", lineTotal: "300.00" });
    expect(d.items).toContainEqual({ kind: "removed", name: "Training", lineTotal: "500.00" });
  });
  it("item kembar tidak tertukar (dicocokkan menurut urutan kemunculan)", () => {
    const a = snap({ items: [item(), item({ quantity: "5.00", lineTotal: "5000.00" })] });
    const b = snap({ items: [item(), item({ quantity: "6.00", lineTotal: "6000.00" })] });
    const d = diffSnapshots(a, b);
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ kind: "changed" });
  });
});

describe("approval", () => {
  it("requiresApproval memakai Decimal & batas inklusif; null/kosong = tidak perlu", () => {
    expect(requiresApproval("1000.00", "1000.00")).toBe(true);
    expect(requiresApproval("999.99", "1000.00")).toBe(false);
    expect(requiresApproval("1000000.00", null)).toBe(false);
    expect(requiresApproval("0.30", "0.1")).toBe(true);
  });
  it("canDecide: peran approver; manager tidak boleh menyetujui pengajuannya sendiri", () => {
    expect(canDecide({ role: "sales_rep", userId: "u", requestedBy: "x" })).toBe(false);
    expect(canDecide({ role: "viewer", userId: "u", requestedBy: "x" })).toBe(false);
    expect(canDecide({ role: "sales_manager", userId: "u", requestedBy: "u" })).toBe(false);
    expect(canDecide({ role: "sales_manager", userId: "u", requestedBy: "x" })).toBe(true);
    expect(canDecide({ role: "admin", userId: "u", requestedBy: "u" })).toBe(true);
  });
});

describe("analyzeRepeat", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const d = (s: string) => new Date(`${s}T10:00:00Z`);
  it("satu pembelian: lama (≥90 hari) vs baru", () => {
    expect(analyzeRepeat([d("2026-02-01")], now)!.status).toBe("one_time_stale");
    expect(analyzeRepeat([d("2026-06-01")], now)!.status).toBe("one_time_recent");
    expect(analyzeRepeat([], now)).toBeNull();
  });
  it("≥2 pembelian: interval rata-rata → perkiraan; overdue/soon/scheduled", () => {
    // interval 30 hari: 1 Jan, 31 Jan, 2 Mar (≈30,30) → last 2 Mar + 30 = 1 Apr → overdue per 30 Jun
    const a = analyzeRepeat([d("2026-01-01"), d("2026-01-31"), d("2026-03-02")], now)!;
    expect(a).toMatchObject({ purchases: 3, avgIntervalDays: 30, status: "overdue" });
    expect(a.predictedNextAt!.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(a.daysLate).toBe(90);
    const soon = analyzeRepeat([d("2026-04-15"), d("2026-05-15")], now)!; // prediksi 14 Jun...
    expect(["overdue", "soon"]).toContain(soon.status);
    const future = analyzeRepeat([d("2026-05-20"), d("2026-06-25")], now)!; // 36 hari → prediksi 31 Jul
    expect(future.status).toBe("scheduled");
    const near = analyzeRepeat([d("2026-05-01"), d("2026-06-01")], now)!; // 31 hari → 2 Jul (2 hari lagi)
    expect(near.status).toBe("soon");
  });
  it("pembelian di hari yang sama dihitung satu", () => {
    expect(analyzeRepeat([d("2026-06-01"), d("2026-06-01")], now)!.purchases).toBe(1);
  });
});
