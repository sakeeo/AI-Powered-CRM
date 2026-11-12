/**
 * Payload webhook keluar: field eksplisit (whitelist) — catatan internal, alasan Lost bebas, dan
 * rahasia tidak pernah ikut. Uang sebagai string desimal; tanggal ISO.
 */
type D = { toFixed: (n: number) => string } | string | number | null | undefined;
const money = (v: D) =>
  v === null || v === undefined ? null : typeof v === "object" ? v.toFixed(2) : String(v);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export const leadPayload = (l: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: string;
  sourceId: string | null;
  ownerId: string | null;
  budget: D;
  currency: string;
  customFields?: unknown;
  createdAt: Date;
}) => ({
  id: l.id,
  name: l.name,
  email: l.email,
  phone: l.phone,
  companyName: l.companyName,
  status: l.status,
  sourceId: l.sourceId,
  ownerId: l.ownerId,
  budget: money(l.budget),
  currency: l.currency,
  customFields: l.customFields ?? {},
  createdAt: iso(l.createdAt),
});

export const contactPayload = (c: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  ownerId: string | null;
  customFields?: unknown;
  createdAt: Date;
}) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  phone: c.phone,
  jobTitle: c.jobTitle,
  ownerId: c.ownerId,
  customFields: c.customFields ?? {},
  createdAt: iso(c.createdAt),
});

export const dealPayload = (d: {
  id: string;
  title: string;
  status: string;
  value: D;
  currency: string;
  stageId: string;
  contactId: string | null;
  companyId: string | null;
  ownerId: string | null;
  closedAt?: Date | null;
  lostCategory?: string | null;
  customFields?: unknown;
}) => ({
  id: d.id,
  title: d.title,
  status: d.status,
  value: money(d.value),
  currency: d.currency,
  stageId: d.stageId,
  contactId: d.contactId,
  companyId: d.companyId,
  ownerId: d.ownerId,
  closedAt: iso(d.closedAt),
  lostCategory: d.lostCategory ?? null,
  customFields: d.customFields ?? {},
});

export const quotationPayload = (q: {
  id: string;
  number: string;
  status: string;
  total: D;
  currency: string;
  validUntil: Date;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  ownerId: string | null;
}) => ({
  id: q.id,
  number: q.number,
  status: q.status,
  total: money(q.total),
  currency: q.currency,
  validUntil: q.validUntil.toISOString().slice(0, 10),
  dealId: q.dealId,
  contactId: q.contactId,
  companyId: q.companyId,
  ownerId: q.ownerId,
});

/** Perpindahan stage deal: payload deal + stage asal/tujuan. */
export const stageChangePayload = (
  d: Parameters<typeof dealPayload>[0],
  fromStageId: string,
  toStageId: string,
) => ({ ...dealPayload(d), fromStageId, toStageId });

/** Konversi lead → record CRM (id hasil konversi). */
export const leadConvertedPayload = (
  l: Parameters<typeof leadPayload>[0],
  r: { contactId: string | null; companyId: string | null; dealId: string | null },
) => ({ ...leadPayload(l), contactId: r.contactId, companyId: r.companyId, dealId: r.dealId });

/** Customer baru = party (company, atau contact bila tanpa company) dengan deal Won pertamanya. */
export const customerPayload = (c: {
  partyType: "company" | "contact";
  partyId: string;
  dealId: string;
  value: D;
  currency: string;
  wonAt: Date;
}) => ({
  partyType: c.partyType,
  partyId: c.partyId,
  firstDealId: c.dealId,
  firstDealValue: money(c.value),
  currency: c.currency,
  wonAt: iso(c.wonAt),
});

export const productPayload = (p: {
  id: string;
  name: string;
  sku: string | null;
  price: D;
  currency: string;
  isActive: boolean;
  categoryId: string | null;
}) => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  price: money(p.price),
  currency: p.currency,
  isActive: p.isActive,
  categoryId: p.categoryId,
});
