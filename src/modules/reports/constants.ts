export const REPORT_TYPES = [
  "lead",
  "pipeline",
  "winlost",
  "conversion",
  "source",
  "sales",
  "activity",
  "revenue",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_LABEL: Record<ReportType, string> = {
  lead: "Lead",
  pipeline: "Pipeline",
  winlost: "Won/Lost",
  conversion: "Conversion",
  source: "Lead Source",
  sales: "Sales Performance",
  activity: "Activity",
  revenue: "Revenue",
};
/** Kategori baku alasan Lost (Safe AI Lost Reason Categorizer mengusulkan salah satu; user yang memutuskan). */
export const LOST_CATEGORIES = [
  "Harga",
  "Kompetitor",
  "Kebutuhan berubah",
  "Timing / anggaran",
  "Tidak responsif",
  "Fitur / kualitas",
  "Lainnya",
] as const;
export type LostCategory = (typeof LOST_CATEGORIES)[number];
export const UNCATEGORIZED = "Belum dikategorikan";
