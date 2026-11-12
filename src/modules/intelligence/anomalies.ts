/**
 * Definisi anomali (plan 3.4) — murni & deterministik; hanya menghasilkan INFORMASI.
 *
 * 1. `vip_activity_drop`: customer VIP (20% teratas menurut total pembelian, mata uang default) yang aktivitasnya
 *    turun tajam — ≤ 25% dari rata-rata 30 harinya pada 90 hari sebelumnya (baseline ≥ 2 interaksi/30 hari).
 * 2. `win_rate_drop`: win rate 30 hari terakhir turun ≥ 20 poin vs 90 hari sebelumnya (≥ 5 deal tertutup per jendela).
 * 3. `lead_inflow_drop`: lead baru 14 hari terakhir ≤ 50% dari rata-rata 14 harinya pada 56 hari sebelumnya
 *    (baseline ≥ 8 lead per 14 hari).
 */
export const ANOMALY_KINDS = ["vip_activity_drop", "win_rate_drop", "lead_inflow_drop"] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  vip_activity_drop: "Aktivitas VIP menurun",
  win_rate_drop: "Win rate menurun",
  lead_inflow_drop: "Lead baru menurun",
};

export const THRESHOLDS = {
  vipTopShare: 0.2,
  vipMinBaseline: 6, // interaksi dalam 90 hari baseline (= 2 per 30 hari)
  vipDropRatio: 0.25,
  winMinClosed: 5,
  winDropPoints: 0.2,
  leadMinBaseline: 8,
  leadDropRatio: 0.5,
} as const;

export type Anomaly = {
  kind: AnomalyKind;
  severity: "high" | "medium";
  title: string;
  detail: string;
  subject?: { type: "company" | "contact"; id: string; ownerId: string | null };
  /** Kunci unik tanpa komponen waktu; pemindai menambahkan pekan. */
  key: string;
  data: Record<string, number | string>;
};

export type PartyActivity = {
  type: "company" | "contact";
  id: string;
  name: string;
  ownerId: string | null;
  /** Total pembelian (mata uang default). */
  total: number;
  /** Interaksi 30 hari terakhir. */
  recent: number;
  /** Interaksi pada 90 hari sebelum jendela terakhir. */
  baseline90: number;
};

export function detectVipDrops(parties: PartyActivity[]): Anomaly[] {
  const ranked = parties.filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  if (ranked.length === 0) return [];
  const topN = Math.max(1, Math.ceil(ranked.length * THRESHOLDS.vipTopShare));
  const vip = ranked.slice(0, topN);
  const out: Anomaly[] = [];
  for (const p of vip) {
    if (p.baseline90 < THRESHOLDS.vipMinBaseline) continue;
    const perMonth = p.baseline90 / 3;
    if (p.recent > perMonth * THRESHOLDS.vipDropRatio) continue;
    out.push({
      kind: "vip_activity_drop",
      severity: p.recent === 0 ? "high" : "medium",
      title: `Aktivitas ${p.name} menurun`,
      detail: `Customer VIP ini hanya punya ${p.recent} interaksi dalam 30 hari terakhir, padahal rata-rata ${perMonth.toFixed(1)} per 30 hari sebelumnya. Pertimbangkan menghubungi lebih dulu.`,
      subject: { type: p.type, id: p.id, ownerId: p.ownerId },
      key: `vip:${p.type}:${p.id}`,
      data: { recent: p.recent, baselinePerMonth: Number(perMonth.toFixed(2)), total: p.total },
    });
  }
  return out;
}

export function detectWinRateDrop(w: {
  recentWon: number;
  recentLost: number;
  priorWon: number;
  priorLost: number;
}): Anomaly | null {
  const r = w.recentWon + w.recentLost;
  const p = w.priorWon + w.priorLost;
  if (r < THRESHOLDS.winMinClosed || p < THRESHOLDS.winMinClosed) return null;
  const recent = w.recentWon / r;
  const prior = w.priorWon / p;
  if (prior - recent < THRESHOLDS.winDropPoints) return null;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return {
    kind: "win_rate_drop",
    severity: prior - recent >= 0.4 ? "high" : "medium",
    title: "Win rate menurun",
    detail: `Win rate 30 hari terakhir ${pct(recent)} (${w.recentWon}/${r}) vs ${pct(prior)} (${w.priorWon}/${p}) pada 90 hari sebelumnya. Tinjau alasan Lost terbaru.`,
    key: "org:win_rate",
    data: { recent: Number(recent.toFixed(3)), prior: Number(prior.toFixed(3)) },
  };
}

export function detectLeadInflowDrop(w: { recent14: number; prior56: number }): Anomaly | null {
  const base = w.prior56 / 4;
  if (base < THRESHOLDS.leadMinBaseline) return null;
  if (w.recent14 > base * THRESHOLDS.leadDropRatio) return null;
  return {
    kind: "lead_inflow_drop",
    severity: w.recent14 === 0 ? "high" : "medium",
    title: "Lead baru menurun",
    detail: `Hanya ${w.recent14} lead baru dalam 14 hari terakhir, padahal rata-rata ${base.toFixed(1)} per 14 hari sebelumnya. Periksa sumber lead & kampanye.`,
    key: "org:lead_inflow",
    data: { recent14: w.recent14, baselinePer14: Number(base.toFixed(2)) },
  };
}

/** Awal pekan (Senin, UTC) sebagai komponen kunci idempoten: anomali yang masih berlangsung muncul lagi tiap pekan. */
export function weekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Senin = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
