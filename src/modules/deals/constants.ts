/** Stage default (PRD §4.4). Won/Lost adalah outcome terminal pada Deal.status, bukan stage. */
export const DEFAULT_PIPELINE_NAME = "Sales Pipeline";
export const DEFAULT_STAGES: { name: string; probability: number }[] = [
  { name: "New Opportunity", probability: 10 },
  { name: "Contacted", probability: 20 },
  { name: "Needs Analysis", probability: 40 },
  { name: "Proposal / Quotation", probability: 60 },
  { name: "Negotiation", probability: 80 },
];

export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];
export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};
export const DEAL_STATUS_TONE: Record<DealStatus, "blue" | "green" | "red"> = {
  open: "blue",
  won: "green",
  lost: "red",
};

export const DEAL_SORTS = ["title", "value", "expectedCloseDate", "createdAt"] as const;
