import { z } from "zod";
import { CURRENCY_CODES, optionalMoney, requiredMoney } from "@/lib/money";
import { optionalText, optionalUuid } from "@/lib/schema-helpers";
import { QUOTATION_STATUSES } from "@/modules/quotations/calc";

export const QUOTATION_SORTS = ["number", "total", "validUntil", "createdAt"] as const;

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Tanggal tidak valid");

const percent = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? "0" : String(v).replace(",", ".")),
  z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Persentase tidak valid")
    .refine((s) => Number(s) <= 100, "Maksimal 100"),
);
const quantity = z.preprocess(
  (v) =>
    typeof v === "number" ? String(v) : typeof v === "string" ? v.replace(",", ".").trim() : v,
  z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Jumlah tidak valid")
    .refine((s) => Number(s) > 0, "Jumlah harus > 0"),
);

export const quotationItemSchema = z.object({
  productId: optionalUuid,
  name: z.string().trim().min(1, "Nama item wajib diisi").max(160),
  description: optionalText(500),
  quantity,
  unitPrice: requiredMoney,
  discountPercent: percent,
});
export type QuotationItemInput = z.input<typeof quotationItemSchema>;

export const createQuotationSchema = z.object({
  title: optionalText(160),
  dealId: optionalUuid,
  contactId: optionalUuid,
  companyId: optionalUuid,
});

export const saveQuotationSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2, "Judul minimal 2 karakter").max(160),
  validUntil: date,
  currency: z.enum(CURRENCY_CODES),
  contactId: optionalUuid,
  companyId: optionalUuid,
  notes: optionalText(3000),
  terms: optionalText(5000),
  narrative: optionalText(6000),
  globalDiscountPercent: percent,
  items: z.array(quotationItemSchema).min(1, "Tambahkan minimal satu item").max(100),
});
export type SaveQuotationInput = z.input<typeof saveQuotationSchema>;

export const setQuotationStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(QUOTATION_STATUSES),
});

export const quotationSettingsSchema = z.object({
  taxLabel: z.string().trim().min(1, "Label pajak wajib diisi").max(20),
  taxRate: percent,
  taxInclusive: z.boolean(),
  validityDays: z.coerce.number().int("Bilangan bulat").min(1).max(365),
  terms: optionalText(5000),
  /** Kosong = tanpa approval; total ≥ nilai ini perlu persetujuan sebelum dikirim */
  approvalThreshold: optionalMoney,
});
