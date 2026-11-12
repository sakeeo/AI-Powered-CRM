import { z } from "zod";
import { OUTBOUND_EVENTS, OUTBOUND_PROVIDERS } from "@/modules/integrations/constants";

const base = {
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  url: z.string().trim().min(8, "URL wajib diisi").max(1000),
  events: z.array(z.enum(OUTBOUND_EVENTS)).min(1, "Pilih minimal satu event"),
};
export const createOutboundSchema = z.object({ provider: z.enum(OUTBOUND_PROVIDERS), ...base });
export const updateOutboundSchema = z.object({ id: z.uuid(), ...base, isActive: z.boolean() });
