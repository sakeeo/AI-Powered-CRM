import { z } from "zod";

export const PARTY_TYPES = ["company", "contact"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];
export const CUSTOMER_SORTS = ["name", "lastWonAt", "wonCount"] as const;

export const partySchema = z.object({ type: z.enum(PARTY_TYPES), id: z.uuid() });
export const assignSegmentSchema = partySchema.extend({
  name: z.string().trim().min(2, "Nama segmen minimal 2 karakter").max(40),
});
export const removeSegmentSchema = partySchema.extend({ segmentId: z.uuid() });
