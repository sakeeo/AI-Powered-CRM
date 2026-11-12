import { z } from "zod";
import {
  OUTBOUND_EVENTS,
  OUTBOUND_EVENT_LABEL,
  OUTBOUND_SCHEMA_VERSION,
  type OutboundEvent,
} from "@/modules/integrations/constants";

/**
 * Katalog event bisnis & skema payload ber-versi (plan 3.7). Satu sumber kebenaran untuk: validasi payload
 * sebelum dikirim, dokumentasi di UI (Katalog event), dan docs/webhooks.md. Uang = string desimal, tanggal = ISO 8601.
 */
export const EVENT_CATEGORIES = ["crm", "sales", "accounting", "catalog"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  crm: "CRM (lead & contact)",
  sales: "Penjualan (deal & quotation)",
  accounting: "ERP / Akuntansi",
  catalog: "POS / Katalog produk",
};

const uuid = z.string().min(1);
const money = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
const isoDate = z.string().datetime({ offset: true });
const nullable = <T extends z.ZodType>(t: T) => t.nullable();

const lead = z.object({
  id: uuid,
  name: z.string(),
  email: nullable(z.string()),
  phone: nullable(z.string()),
  companyName: nullable(z.string()),
  status: z.string(),
  sourceId: nullable(uuid),
  ownerId: nullable(uuid),
  budget: nullable(money),
  currency: z.string(),
  customFields: z.record(z.string(), z.unknown()),
  createdAt: isoDate,
});
const contact = z.object({
  id: uuid,
  name: z.string(),
  email: nullable(z.string()),
  phone: nullable(z.string()),
  jobTitle: nullable(z.string()),
  ownerId: nullable(uuid),
  customFields: z.record(z.string(), z.unknown()),
  createdAt: isoDate,
});
const deal = z.object({
  id: uuid,
  title: z.string(),
  status: z.enum(["open", "won", "lost"]),
  value: nullable(money),
  currency: z.string(),
  stageId: uuid,
  contactId: nullable(uuid),
  companyId: nullable(uuid),
  ownerId: nullable(uuid),
  closedAt: nullable(isoDate),
  lostCategory: nullable(z.string()),
  customFields: z.record(z.string(), z.unknown()),
});
const quotation = z.object({
  id: uuid,
  number: z.string(),
  status: z.string(),
  total: nullable(money),
  currency: z.string(),
  validUntil: z.string(),
  dealId: nullable(uuid),
  contactId: nullable(uuid),
  companyId: nullable(uuid),
  ownerId: nullable(uuid),
});

export const EVENT_SCHEMAS: Record<OutboundEvent, z.ZodType> = {
  "lead.created": lead,
  "lead.converted": lead.extend({
    contactId: nullable(uuid),
    companyId: nullable(uuid),
    dealId: nullable(uuid),
  }),
  "contact.created": contact,
  "deal.created": deal,
  "deal.stage_changed": deal.extend({ fromStageId: uuid, toStageId: uuid }),
  "deal.won": deal,
  "deal.lost": deal,
  "customer.created": z.object({
    partyType: z.enum(["company", "contact"]),
    partyId: uuid,
    firstDealId: uuid,
    firstDealValue: nullable(money),
    currency: z.string(),
    wonAt: isoDate,
  }),
  "quotation.sent": quotation,
  "quotation.accepted": quotation,
  "quotation.rejected": quotation,
  "product.created": z.object({
    id: uuid,
    name: z.string(),
    sku: nullable(z.string()),
    price: nullable(money),
    currency: z.string(),
    isActive: z.boolean(),
    categoryId: nullable(uuid),
  }),
  "product.updated": z.object({
    id: uuid,
    name: z.string(),
    sku: nullable(z.string()),
    price: nullable(money),
    currency: z.string(),
    isActive: z.boolean(),
    categoryId: nullable(uuid),
  }),
};

export type EventInfo = {
  event: OutboundEvent;
  label: string;
  category: EventCategory;
  description: string;
  /** Kunci utama payload `data` (ringkas, untuk dokumentasi). */
  fields: string[];
  /** Contoh kasus pakai integrasi. */
  useCase: string;
};

export const EVENT_CATALOG: EventInfo[] = [
  {
    event: "lead.created",
    label: OUTBOUND_EVENT_LABEL["lead.created"],
    category: "crm",
    description: "Lead baru masuk (manual, import, webhook masuk, atau dari inbox).",
    fields: [
      "id",
      "name",
      "email",
      "phone",
      "companyName",
      "status",
      "sourceId",
      "ownerId",
      "budget",
      "currency",
      "customFields",
      "createdAt",
    ],
    useCase: "Sinkron prospek ke ERP/marketing.",
  },
  {
    event: "lead.converted",
    label: OUTBOUND_EVENT_LABEL["lead.converted"],
    category: "crm",
    description: "Lead dikonversi menjadi contact/company/deal.",
    fields: ["…lead", "contactId", "companyId", "dealId"],
    useCase: "Buat pelanggan prospek di sistem lain.",
  },
  {
    event: "contact.created",
    label: OUTBOUND_EVENT_LABEL["contact.created"],
    category: "crm",
    description: "Contact baru dibuat.",
    fields: ["id", "name", "email", "phone", "jobTitle", "ownerId", "customFields", "createdAt"],
    useCase: "Sinkron buku alamat.",
  },
  {
    event: "deal.created",
    label: OUTBOUND_EVENT_LABEL["deal.created"],
    category: "sales",
    description: "Deal baru dibuat.",
    fields: [
      "id",
      "title",
      "status",
      "value",
      "currency",
      "stageId",
      "contactId",
      "companyId",
      "ownerId",
      "closedAt",
      "lostCategory",
      "customFields",
    ],
    useCase: "Notifikasi/pipeline mirror.",
  },
  {
    event: "deal.stage_changed",
    label: OUTBOUND_EVENT_LABEL["deal.stage_changed"],
    category: "sales",
    description: "Deal terbuka berpindah stage.",
    fields: ["…deal", "fromStageId", "toStageId"],
    useCase: "Pelacakan funnel di BI.",
  },
  {
    event: "deal.won",
    label: OUTBOUND_EVENT_LABEL["deal.won"],
    category: "accounting",
    description: "Deal ditandai Won — pemicu pembuatan sales order / invoice di ERP.",
    fields: ["…deal", "closedAt"],
    useCase: "Buat Sales Order/Invoice di ERP atau akuntansi.",
  },
  {
    event: "deal.lost",
    label: OUTBOUND_EVENT_LABEL["deal.lost"],
    category: "sales",
    description: "Deal ditandai Lost (kategori alasan baku, tanpa teks alasan bebas).",
    fields: ["…deal", "closedAt", "lostCategory"],
    useCase: "Analisis win/loss.",
  },
  {
    event: "customer.created",
    label: OUTBOUND_EVENT_LABEL["customer.created"],
    category: "accounting",
    description: "Pihak (company, atau contact tanpa company) mendapat deal Won pertamanya.",
    fields: ["partyType", "partyId", "firstDealId", "firstDealValue", "currency", "wonAt"],
    useCase: "Buat master pelanggan di akuntansi.",
  },
  {
    event: "quotation.sent",
    label: OUTBOUND_EVENT_LABEL["quotation.sent"],
    category: "sales",
    description: "Quotation ditandai terkirim.",
    fields: [
      "id",
      "number",
      "status",
      "total",
      "currency",
      "validUntil",
      "dealId",
      "contactId",
      "companyId",
      "ownerId",
    ],
    useCase: "Catat penawaran di ERP.",
  },
  {
    event: "quotation.accepted",
    label: OUTBOUND_EVENT_LABEL["quotation.accepted"],
    category: "accounting",
    description: "Pelanggan menyetujui quotation — dasar sales order.",
    fields: [
      "id",
      "number",
      "status",
      "total",
      "currency",
      "validUntil",
      "dealId",
      "contactId",
      "companyId",
      "ownerId",
    ],
    useCase: "Buat Sales Order di ERP.",
  },
  {
    event: "quotation.rejected",
    label: OUTBOUND_EVENT_LABEL["quotation.rejected"],
    category: "sales",
    description: "Pelanggan menolak quotation.",
    fields: [
      "id",
      "number",
      "status",
      "total",
      "currency",
      "validUntil",
      "dealId",
      "contactId",
      "companyId",
      "ownerId",
    ],
    useCase: "Tutup penawaran di ERP.",
  },
  {
    event: "product.created",
    label: OUTBOUND_EVENT_LABEL["product.created"],
    category: "catalog",
    description: "Produk/layanan baru di katalog.",
    fields: ["id", "name", "sku", "price", "currency", "isActive", "categoryId"],
    useCase: "Sinkron katalog ke POS.",
  },
  {
    event: "product.updated",
    label: OUTBOUND_EVENT_LABEL["product.updated"],
    category: "catalog",
    description: "Produk diubah (nama, harga, aktif/nonaktif).",
    fields: ["id", "name", "sku", "price", "currency", "isActive", "categoryId"],
    useCase: "Sinkron harga ke POS.",
  },
];

export const SCHEMA_VERSION = OUTBOUND_SCHEMA_VERSION;

/** Pastikan katalog mencakup semua event (dijaga test). */
export const CATALOG_EVENTS = EVENT_CATALOG.map((e) => e.event);
export const ALL_EVENTS = OUTBOUND_EVENTS;

export function validateEventData(event: OutboundEvent, data: unknown) {
  return EVENT_SCHEMAS[event].safeParse(data);
}
