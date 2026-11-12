export const WA_PROVIDERS = ["fonnte", "http"] as const;
export type WaProvider = (typeof WA_PROVIDERS)[number];

export const WA_PROVIDER_INFO: Record<
  WaProvider,
  { type: `whatsapp_${WaProvider}`; title: string; description: string }
> = {
  fonnte: {
    type: "whatsapp_fonnte",
    title: "Fonnte",
    description:
      "Gateway WhatsApp populer di Indonesia. Gunakan token perangkat dari dashboard Fonnte.",
  },
  http: {
    type: "whatsapp_http",
    title: "Gateway HTTP kustom",
    description:
      "Gateway Anda sendiri: CRM mengirim POST JSON {to, message} ke URL HTTPS dengan header Authorization: Bearer <token>.",
  },
};

export const WA_TYPES = WA_PROVIDERS.map((p) => WA_PROVIDER_INFO[p].type);
export const waProviderFromType = (type: string): WaProvider | null =>
  WA_PROVIDERS.find((p) => WA_PROVIDER_INFO[p].type === type) ?? null;

export const MAX_MESSAGE_LENGTH = 4000;
export const CONVERSATION_STATUSES = ["open", "closed"] as const;
