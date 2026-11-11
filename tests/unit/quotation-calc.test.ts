import { describe, expect, it } from "vitest";
import { calculateQuotation, canTransition } from "@/modules/quotations/calc";

const opts = { taxRate: "11" };

describe("calculateQuotation", () => {
  it("kasus dasar: subtotal, pajak eksklusif, total", () => {
    const r = calculateQuotation(
      [
        { quantity: 2, unitPrice: "1000000" },
        { quantity: 1, unitPrice: "500000.50" },
      ],
      opts,
    );
    expect(r).toMatchObject({
      subtotal: "2500000.50",
      discountTotal: "0.00",
      taxable: "2500000.50",
      taxTotal: "275000.06",
      total: "2775000.56",
    });
  });

  it("tidak ada galat floating point (0.1 + 0.2, 3 × 0.1)", () => {
    expect(
      calculateQuotation(
        [
          { quantity: 1, unitPrice: "0.10" },
          { quantity: 1, unitPrice: "0.20" },
        ],
        { taxRate: 0 },
      ).total,
    ).toBe("0.30");
    expect(calculateQuotation([{ quantity: 3, unitPrice: "0.10" }], { taxRate: 0 }).total).toBe(
      "0.30",
    );
    expect(
      calculateQuotation([{ quantity: "1.1", unitPrice: "19.99" }], { taxRate: 0 }).subtotal,
    ).toBe("21.99");
  });

  it("diskon per baris dibulatkan HALF_UP per baris, lalu dijumlahkan", () => {
    const r = calculateQuotation(
      [
        { quantity: 1, unitPrice: "10.05", discountPercent: 10 }, // 1.005 → 1.01
        { quantity: 1, unitPrice: "10.05", discountPercent: 10 }, // 1.01
      ],
      { taxRate: 0 },
    );
    expect(r.lines.map((l) => l.discount)).toEqual(["1.01", "1.01"]);
    expect(r).toMatchObject({ subtotal: "20.10", discountTotal: "2.02", total: "18.08" });
  });

  it("diskon global dihitung setelah diskon baris, sebelum pajak", () => {
    const r = calculateQuotation([{ quantity: 1, unitPrice: "1000", discountPercent: 10 }], {
      taxRate: 10,
      globalDiscountPercent: 10,
    });
    // 1000 − 100 (baris) = 900; − 90 (global) = 810 DPP; pajak 81
    expect(r).toMatchObject({
      subtotal: "1000.00",
      discountTotal: "190.00",
      taxable: "810.00",
      taxTotal: "81.00",
      total: "891.00",
    });
  });

  it("pajak inklusif: total = DPP, pajak diekstrak dari harga", () => {
    const r = calculateQuotation([{ quantity: 1, unitPrice: "111000" }], {
      taxRate: 11,
      taxInclusive: true,
    });
    expect(r).toMatchObject({ taxable: "111000.00", taxTotal: "11000.00", total: "111000.00" });
  });

  it("pembulatan pajak HALF_UP (0.125 → 0.13) dan nilai besar tetap presisi", () => {
    expect(calculateQuotation([{ quantity: 1, unitPrice: "2.50" }], { taxRate: 5 }).taxTotal).toBe(
      "0.13",
    );
    const big = calculateQuotation([{ quantity: 1, unitPrice: "9999999999999.99" }], {
      taxRate: 11,
    });
    expect(big.total).toBe("11099999999999.99");
    expect(big.subtotal).toBe("9999999999999.99");
    expect(big.taxTotal).toBe("1100000000000.00");
  });

  it("daftar kosong → nol; masukan tidak valid ditolak", () => {
    expect(calculateQuotation([], opts)).toMatchObject({
      subtotal: "0.00",
      taxTotal: "0.00",
      total: "0.00",
    });
    expect(() => calculateQuotation([{ quantity: -1, unitPrice: "1" }], opts)).toThrow();
    expect(() => calculateQuotation([{ quantity: 1, unitPrice: "abc" }], opts)).toThrow();
    expect(() =>
      calculateQuotation([{ quantity: 1, unitPrice: "1", discountPercent: 101 }], opts),
    ).toThrow();
    expect(() => calculateQuotation([], { taxRate: 101 })).toThrow();
  });

  it("deterministik: masukan sama → keluaran identik", () => {
    const items = [{ quantity: 3, unitPrice: "333.33", discountPercent: 7.5 }];
    expect(calculateQuotation(items, opts)).toEqual(calculateQuotation(items, opts));
  });
});

describe("transisi status", () => {
  it("hanya transisi yang diizinkan", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("draft", "accepted")).toBe(false);
    expect(canTransition("sent", "accepted")).toBe(true);
    expect(canTransition("sent", "draft")).toBe(true);
    expect(canTransition("accepted", "draft")).toBe(false);
    expect(canTransition("rejected", "draft")).toBe(true);
    expect(canTransition("expired", "sent")).toBe(false);
  });
});
