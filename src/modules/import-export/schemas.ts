import { z } from "zod";
import { optionalUuid } from "@/lib/schema-helpers";
import { IMPORT_BATCH_SIZE } from "@/modules/import-export/mapping";

export const importLeadsBatchSchema = z.object({
  rows: z
    .array(z.record(z.string(), z.string().max(5000)))
    .min(1)
    .max(IMPORT_BATCH_SIZE * 2),
  /** Nomor baris CSV (1 = header) dari baris pertama batch ini; untuk laporan error. */
  startRow: z.number().int().min(2),
  sourceId: optionalUuid,
  ownerId: optionalUuid,
});

export const EXPORT_ENTITIES = ["leads", "contacts", "companies"] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];
