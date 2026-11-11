import Decimal from "decimal.js";

/**
 * Perhitungan quotation DETERMINISTIK (decimal.js, tanpa float, tanpa LLM).
 * Semua masukan/keluaran berupa string desimal. Pembulatan ROUND_HALF_UP ke 2 digit pada:
 * diskon per baris, diskon global, dan pajak. Dipakai bersama oleh server (sumber kebenaran) dan UI (pratinjau).
 *
 * Alur:  gross = qty × harga satuan
 *        diskon baris = round(gross × diskon% / 100)
 *        subtotal = Σ gross;  diskon = Σ diskon baris + diskon global
 *        dpp (dasar pajak) = subtotal − diskon
 *        eksklusif: pajak = round(dpp × tarif/100), total = dpp + pajak
 *        inklusif : harga sudah termasuk pajak → total = dpp, pajak = round(dpp − dpp/(1+tarif/100))
 * CRM bukan sistem perpajakan/akuntansi: angka ini hanya estimasi untuk penawaran.
 */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type CalcItem = {
  quantity: string | number;
  unitPrice: string;
  discountPercent?: string | number;
};
export type CalcOptions = {
  taxRate: string | number;
  taxInclusive?: boolean;
  /** Diskon global (%) atas total setelah diskon baris. */
  globalDiscountPercent?: string | number;
};
export type CalcResult = {
  lines: { gross: string; discount: string; net: string }[];
  subtotal: string;
  discountTotal: string;
  taxable: string;
  taxTotal: string;
  total: string;
};

const r2 = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const s2 = (d: Decimal) => r2(d).toFixed(2);

function num(v: string | number | undefined, name: string, max?: number): Decimal {
  const d = new D(v === undefined || v === "" ? 0 : v);
  if (!d.isFinite() || d.isNegative()) throw new Error(`${name} tidak valid`);
  if (max !== undefined && d.gt(max)) throw new Error(`${name} melebihi ${max}`);
  return d;
}

export function calculateQuotation(items: CalcItem[], opts: CalcOptions): CalcResult {
  const taxRate = num(opts.taxRate, "Tarif pajak", 100);
  const globalPct = num(opts.globalDiscountPercent, "Diskon global", 100);

  let subtotal = new D(0);
  let lineDiscounts = new D(0);
  const lines = items.map((it) => {
    const gross = r2(num(it.quantity, "Jumlah").mul(num(it.unitPrice, "Harga satuan")));
    const discount = r2(gross.mul(num(it.discountPercent, "Diskon", 100)).div(100));
    subtotal = subtotal.plus(gross);
    lineDiscounts = lineDiscounts.plus(discount);
    return {
      gross: gross.toFixed(2),
      discount: discount.toFixed(2),
      net: gross.minus(discount).toFixed(2),
    };
  });

  const afterLine = subtotal.minus(lineDiscounts);
  const globalDiscount = r2(afterLine.mul(globalPct).div(100));
  const discountTotal = lineDiscounts.plus(globalDiscount);
  const taxable = subtotal.minus(discountTotal);

  let taxTotal: Decimal;
  let total: Decimal;
  if (opts.taxInclusive) {
    total = taxable;
    taxTotal = r2(taxable.minus(taxable.div(new D(1).plus(taxRate.div(100)))));
  } else {
    taxTotal = r2(taxable.mul(taxRate).div(100));
    total = taxable.plus(taxTotal);
  }
  return {
    lines,
    subtotal: s2(subtotal),
    discountTotal: s2(discountTotal),
    taxable: s2(taxable),
    taxTotal: s2(taxTotal),
    total: s2(total),
  };
}

/** Transisi status yang diizinkan (QUO-07). */
export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired", "draft"],
  expired: ["draft"],
  rejected: ["draft"],
  accepted: [],
};
export const canTransition = (from: string, to: string) =>
  (STATUS_TRANSITIONS[from as QuotationStatus] ?? []).includes(to as QuotationStatus);
export const STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};
export const STATUS_TONE: Record<QuotationStatus, "blue" | "orange" | "green" | "red"> = {
  draft: "blue",
  sent: "orange",
  accepted: "green",
  rejected: "red",
  expired: "red",
};
export const QUOTATION_DISCLAIMER =
  "Dokumen ini adalah penawaran harga, bukan faktur pajak maupun dokumen akuntansi. Perhitungan pajak hanya estimasi berdasarkan konfigurasi organisasi.";
