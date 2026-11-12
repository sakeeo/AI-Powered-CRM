import { z } from "zod";
import {
  CONVERSATION_STATUSES,
  MAX_MESSAGE_LENGTH,
  WA_PROVIDERS,
} from "@/modules/whatsapp/constants";

export const saveWaConnectorSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("fonnte"),
    /** Kosong saat mengubah = pertahankan token tersimpan. */
    token: z.string().trim().max(500).optional(),
  }),
  z.object({
    provider: z.literal("http"),
    token: z.string().trim().max(500).optional(),
    apiUrl: z.string().trim().min(8, "URL gateway wajib diisi").max(500),
  }),
]);
export const waProviderSchema = z.object({ provider: z.enum(WA_PROVIDERS) });

export const sendMessageSchema = z.object({
  conversationId: z.uuid(),
  body: z.string().trim().min(1, "Pesan tidak boleh kosong").max(MAX_MESSAGE_LENGTH),
});
export const assignConversationSchema = z.object({
  id: z.uuid(),
  assigneeId: z.uuid().nullable(),
});
export const conversationStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(CONVERSATION_STATUSES),
});
