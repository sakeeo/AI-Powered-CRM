/**
 * Evaluasi kualitas data (Phase 3 exit criteria): fitur prediktif hanya dianggap "siap" bila data
 * memenuhi ambang minimum. Murni agar mudah diuji; metrik dikumpulkan di server/quality.ts.
 */
export type QualityMetrics = {
  leads: number;
  leadsWithContact: number;
  leadsWithSource: number;
  leadsConverted: number;
  dealsWon: number;
  dealsLost: number;
  /** Deal tertutup yang punya riwayat perpindahan stage (dipakai prediksi stage). */
  closedWithHistory: number;
  /** Jumlah bulan kalender berbeda yang punya ≥1 deal tertutup. */
  closedMonths: number;
  activities90d: number;
  customers: number;
};

export type FeatureKey = "leadScoring" | "dealPrediction" | "forecast" | "anomaly";
export type FeatureReadiness = { ready: boolean; reasons: string[] };

export const QUALITY_THRESHOLDS = {
  leads: 20,
  contactRate: 0.5,
  closedDeals: 10,
  perOutcome: 3,
  months: 3,
} as const;

export function evaluateQuality(m: QualityMetrics): Record<FeatureKey, FeatureReadiness> {
  const T = QUALITY_THRESHOLDS;
  const pct = (a: number, b: number) => (b ? a / b : 0);
  const check = (cond: boolean, msg: string, into: string[]) => {
    if (!cond) into.push(msg);
  };

  const lead: string[] = [];
  check(m.leads >= T.leads, `Butuh ≥ ${T.leads} lead (saat ini ${m.leads})`, lead);
  check(
    pct(m.leadsWithContact, m.leads) >= T.contactRate,
    `≥ ${T.contactRate * 100}% lead perlu punya email/telepon (saat ini ${Math.round(pct(m.leadsWithContact, m.leads) * 100)}%)`,
    lead,
  );

  const closed = m.dealsWon + m.dealsLost;
  const deal: string[] = [];
  check(
    closed >= T.closedDeals,
    `Butuh ≥ ${T.closedDeals} deal tertutup (saat ini ${closed})`,
    deal,
  );
  check(
    m.dealsWon >= T.perOutcome,
    `Butuh ≥ ${T.perOutcome} deal Won (saat ini ${m.dealsWon})`,
    deal,
  );
  check(
    m.dealsLost >= T.perOutcome,
    `Butuh ≥ ${T.perOutcome} deal Lost (saat ini ${m.dealsLost})`,
    deal,
  );

  const fc: string[] = [];
  check(closed >= T.closedDeals, `Butuh ≥ ${T.closedDeals} deal tertutup (saat ini ${closed})`, fc);
  check(
    m.closedMonths >= T.months,
    `Butuh riwayat ≥ ${T.months} bulan (saat ini ${m.closedMonths})`,
    fc,
  );

  const an: string[] = [];
  check(m.customers >= 1, "Belum ada customer (deal Won)", an);
  check(m.activities90d >= 1, "Belum ada aktivitas 90 hari terakhir", an);

  return {
    leadScoring: { ready: lead.length === 0, reasons: lead },
    dealPrediction: { ready: deal.length === 0, reasons: deal },
    forecast: { ready: fc.length === 0, reasons: fc },
    anomaly: { ready: an.length === 0, reasons: an },
  };
}
