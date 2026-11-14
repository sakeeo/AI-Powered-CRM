/** Jenis usaha yang tersedia untuk "Load Demo Workspace" (dipakai UI & server). */
export const DEMO_BUSINESSES = ["dealer", "travel"] as const;
export type DemoBusiness = (typeof DEMO_BUSINESSES)[number];

export const DEMO_BUSINESS_INFO: Record<DemoBusiness, { label: string; description: string }> = {
  dealer: {
    label: "Dealer mobil & motor",
    description: "Showroom, servis, sparepart, dan penjualan armada (fleet).",
  },
  travel: {
    label: "Travel Haji & Umroh",
    description: "Paket umroh, haji khusus, rombongan majelis & korporat, dokumen jamaah.",
  },
};
