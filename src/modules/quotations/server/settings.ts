import type { TenantContext } from "@/lib/context";

/** Konfigurasi quotation organisasi (dibuat dengan default bila belum ada). */
export async function getQuotationSettings(db: TenantContext["db"]) {
  const existing = await db.quotationSettings.findFirst();
  const row = existing ?? (await db.quotationSettings.create({ data: {} as never }));
  return {
    taxLabel: row.taxLabel,
    taxRate: row.taxRate.toFixed(2),
    taxInclusive: row.taxInclusive,
    validityDays: row.validityDays,
    terms: row.terms,
  };
}
