import { z } from "zod";
import { AI_PROVIDERS } from "@/modules/connectors/registry";

export const providerSchema = z.enum(AI_PROVIDERS);

export const saveAiConnectorSchema = z.object({
  provider: providerSchema,
  /** Kosong saat hanya mengubah model pada connector yang sudah ada. */
  apiKey: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1, "Nama model wajib diisi").max(120),
});
export const connectorTypeSchema = z.object({ provider: providerSchema });
