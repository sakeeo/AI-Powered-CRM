import { z } from "zod";

/** Longgar sengaja: dipanggil saat pengguna masih mengetik; validasi format ada di form utama. */
export const checkDuplicatesSchema = z.object({
  entity: z.enum(["lead", "contact", "company"]),
  name: z.string().max(200).optional(),
  email: z.string().max(255).optional(),
  phone: z.string().max(40).optional(),
  companyName: z.string().max(200).optional(),
  companyIds: z.array(z.uuid()).max(20).optional(),
  website: z.string().max(255).optional(),
  excludeId: z.uuid().optional(),
});

export const mergeSchema = z.object({
  keepId: z.uuid(),
  mergeId: z.uuid(),
  /** Isi field kosong pada record yang dipertahankan dengan nilai dari duplikat. */
  fillEmpty: z.boolean().default(true),
});
