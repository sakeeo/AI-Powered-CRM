import { z } from "zod";
import {
  CHANNEL_KINDS,
  MAX_CHANNEL_LABEL,
  ROUTING_STRATEGIES,
} from "@/modules/omnichannel/constants";
import { MAX_MESSAGE_LENGTH } from "@/modules/whatsapp/constants";

export const saveRoutingSchema = z.object({
  kind: z.enum(CHANNEL_KINDS),
  strategy: z.enum(ROUTING_STRATEGIES),
  pool: z.array(z.uuid()).max(100).default([]),
});

/** Catat percakapan di kanal lain (Instagram, Telegram, telepon, dst.) secara manual. */
export const logChannelMessageSchema = z
  .object({
    contactId: z.uuid().optional(),
    leadId: z.uuid().optional(),
    channelLabel: z.string().trim().min(2, "Nama kanal minimal 2 karakter").max(MAX_CHANNEL_LABEL),
    direction: z.enum(["in", "out"]),
    body: z.string().trim().min(1, "Isi tidak boleh kosong").max(MAX_MESSAGE_LENGTH),
  })
  .refine((v) => !!(v.contactId || v.leadId), {
    path: ["contactId"],
    message: "Pilih contact atau lead",
  });
