import { z } from "zod";
import { AI_PROVIDERS } from "@/modules/connectors/registry";

export const providerSchema = z.enum(AI_PROVIDERS);

export const saveAiConnectorSchema = z.object({
  provider: providerSchema,
  /** Kosong saat hanya mengubah model pada connector yang sudah ada. */
  apiKey: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1, "Nama model wajib diisi").max(120),
  /** Opsional; hanya untuk provider dengan base URL yang bisa diubah. */
  baseUrl: z.string().trim().max(300).optional(),
});
export const listAiModelsSchema = z.object({
  provider: providerSchema,
  /** Kosong = pakai key tersimpan milik connector yang sudah ada. */
  apiKey: z.string().trim().max(500).optional(),
  baseUrl: z.string().trim().max(300).optional(),
});
export const connectorTypeSchema = z.object({ provider: providerSchema });
