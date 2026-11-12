export const OUTBOUND_EVENTS = [
  "lead.created",
  "lead.converted",
  "contact.created",
  "deal.created",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "customer.created",
  "quotation.sent",
  "quotation.accepted",
  "quotation.rejected",
  "product.created",
  "product.updated",
] as const;
export type OutboundEvent = (typeof OUTBOUND_EVENTS)[number];

export const OUTBOUND_EVENT_LABEL: Record<OutboundEvent, string> = {
  "lead.created": "Lead dibuat",
  "lead.converted": "Lead dikonversi",
  "contact.created": "Contact dibuat",
  "deal.created": "Deal dibuat",
  "deal.stage_changed": "Stage deal berubah",
  "deal.won": "Deal Won",
  "deal.lost": "Deal Lost",
  "customer.created": "Customer baru (Won pertama)",
  "quotation.sent": "Quotation terkirim",
  "quotation.accepted": "Quotation disetujui pelanggan",
  "quotation.rejected": "Quotation ditolak pelanggan",
  "product.created": "Produk dibuat",
  "product.updated": "Produk diubah",
};

/** Versi skema payload. Perubahan yang tidak kompatibel → versi baru; consumer membaca `schemaVersion`. */
export const OUTBOUND_SCHEMA_VERSION = "1";

export const OUTBOUND_PROVIDERS = ["zapier", "make", "custom"] as const;
export type OutboundProvider = (typeof OUTBOUND_PROVIDERS)[number];
export const OUTBOUND_PROVIDER_INFO: Record<
  OutboundProvider,
  { title: string; description: string; placeholder: string }
> = {
  zapier: {
    title: "Zapier",
    description: 'Tempel URL "Catch Hook" dari trigger Webhooks by Zapier.',
    placeholder: "https://hooks.zapier.com/hooks/catch/…",
  },
  make: {
    title: "Make",
    description: "Tempel URL dari modul Custom webhook di skenario Make.",
    placeholder: "https://hook.eu1.make.com/…",
  },
  custom: {
    title: "Webhook kustom",
    description: "Endpoint HTTPS Anda sendiri; verifikasi header X-CRM-Signature.",
    placeholder: "https://example.com/crm-webhook",
  },
};

export const MAX_OUTBOUND_WEBHOOKS = 10;
export const OUTBOUND_MAX_ATTEMPTS = 5;
