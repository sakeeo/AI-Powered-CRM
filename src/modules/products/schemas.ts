import { z } from "zod";
import { CURRENCY_CODES, requiredMoney } from "@/lib/money";
import { optionalText } from "@/lib/schema-helpers";

export const PRODUCT_SORTS = ["name", "price", "createdAt"] as const;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(160),
  description: optionalText(2000),
  sku: optionalText(60),
  /** Nama kategori; dibuat otomatis bila belum ada. */
  categoryName: optionalText(60),
  price: requiredMoney,
  currency: z.enum(CURRENCY_CODES).default("IDR"),
  isActive: z.boolean().default(true),
});
export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;
export const updateProductSchema = productSchema.extend({ id: z.uuid() });
export const setProductActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });

export const addDealProductSchema = z.object({
  dealId: z.uuid(),
  productId: z.uuid(),
  quantity: z.coerce.number().int("Bilangan bulat").min(1, "Minimal 1").max(100000),
  /** Kosong = pakai harga katalog. */
  unitPrice: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().optional()),
});
export const removeDealProductSchema = z.object({ id: z.uuid() });
