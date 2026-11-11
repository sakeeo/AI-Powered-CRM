import { z } from "zod";

/**
 * Uang: JANGAN pakai float. Input form → string desimal (maks 2 digit), disimpan sebagai
 * Decimal(18,2) di database, dikirim ke client sebagai string.
 */
export const CURRENCY_CODES = ["IDR", "USD", "SGD", "MYR", "EUR", "GBP", "AUD", "JPY"] as const;
export const currencySchema = z.enum(CURRENCY_CODES);

const MONEY_RE = /^\d{1,16}(\.\d{1,2})?$/;

function normalizeMoney(v: unknown) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2).replace(/\.?0+$/, "") : "NaN";
  if (typeof v !== "string") return v;
  const t = v.replace(/[\s,]/g, "");
  return t === "" ? undefined : t;
}

/** Jumlah uang non-negatif opsional (string desimal valid). */
export const optionalMoney = z.preprocess(
  normalizeMoney,
  z.string().regex(MONEY_RE, "Nominal tidak valid (maks. 2 desimal)").optional(),
);

/** Jumlah uang non-negatif wajib. */
export const requiredMoney = z.preprocess(
  normalizeMoney,
  z
    .string({ error: "Nominal wajib diisi" })
    .regex(MONEY_RE, "Nominal tidak valid (maks. 2 desimal)"),
);

export function formatMoney(
  value: string | number | null | undefined,
  currency: string,
  locale = "id-ID",
) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" || currency === "JPY" ? 0 : 2,
  }).format(Number(value));
}
