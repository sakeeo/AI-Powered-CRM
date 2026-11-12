export const OUTBOUND_EVENTS = [
  "lead.created",
  "contact.created",
  "deal.created",
  "deal.won",
  "deal.lost",
  "quotation.sent",
] as const;
export type OutboundEvent = (typeof OUTBOUND_EVENTS)[number];

export const OUTBOUND_EVENT_LABEL: Record<OutboundEvent, string> = {
  "lead.created": "Lead dibuat",
  "contact.created": "Contact dibuat",
  "deal.created": "Deal dibuat",
  "deal.won": "Deal Won",
  "deal.lost": "Deal Lost",
  "quotation.sent": "Quotation terkirim",
};

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
