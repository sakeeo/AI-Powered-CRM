/** Status lead (PRD §4.2). Berbeda dari tahap deal. Set tetap di MVP: label tidak dikonfigurasi per organisasi. */
export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
};
export const LEAD_STATUS_TONE: Record<LeadStatus, "blue" | "orange" | "green" | "red"> = {
  new: "blue",
  contacted: "orange",
  qualified: "green",
  unqualified: "red",
};

export const URGENCIES = ["low", "medium", "high"] as const;
export type Urgency = (typeof URGENCIES)[number];
export const URGENCY_LABEL: Record<Urgency, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export const LEAD_SORTS = ["name", "status", "budget", "createdAt"] as const;

/** Sumber lead bawaan untuk organisasi baru. "Website" dipakai webhook (plan 1.8). */
export const DEFAULT_LEAD_SOURCES: { name: string; isSystem?: boolean }[] = [
  { name: "Website", isSystem: true },
  { name: "Referral" },
  { name: "WhatsApp" },
  { name: "Social Media" },
  { name: "Event" },
  { name: "Cold Outreach" },
  { name: "Lainnya" },
];
