/**
 * Asisten penjualan prediktif (plan 3.2) — murni & deterministik, hanya rekomendasi.
 *
 * Probabilitas dasar = win rate historis deal yang pernah mencapai stage ini (disempurnakan dengan prior
 * probabilitas stage agar stabil saat sampel kecil). Sinyal keterlibatan (kebaruan aktivitas, mandek,
 * lewat tanggal closing) menyesuaikan dengan pengali kecil dan SELALU ditampilkan sebagai faktor.
 * Akurasi komponen dasar diukur lewat backtest leave-one-out (`backtestStageModel`).
 */
export type StageInfo = { id: string; position: number; probability: number; name: string };

/** Deal tertutup yang menjadi sampel pelatihan/backtest. `maxPos` = posisi stage tertinggi yang pernah dicapai. */
export type ClosedSample = { won: boolean; maxPos: number };

export const PRIOR_WEIGHT = 4;
const clampP = (p: number) => Math.min(0.98, Math.max(0.02, p));

type Tally = Map<number, { n: number; won: number }>;

/** Hitung (n, won) untuk setiap posisi stage: deal yang pernah mencapai posisi ≥ p. */
export function tally(samples: ClosedSample[], stages: StageInfo[]): Tally {
  const t: Tally = new Map();
  for (const s of stages) {
    let n = 0;
    let won = 0;
    for (const d of samples)
      if (d.maxPos >= s.position) {
        n++;
        if (d.won) won++;
      }
    t.set(s.position, { n, won });
  }
  return t;
}

export function smoothedRate(
  n: number,
  won: number,
  stageProbability: number,
  priorWeight = PRIOR_WEIGHT,
) {
  const prior = clampP(stageProbability / 100);
  return (won + priorWeight * prior) / (n + priorWeight);
}

export type Backtest = {
  /** Jumlah titik evaluasi (deal tertutup × stage yang dicapai). */
  points: number;
  closedDeals: number;
  accuracy: number;
  /** Brier score (0 = sempurna; 0.25 = menebak 50%). */
  brier: number;
  baselineAccuracy: number;
  baselineBrier: number;
};

/**
 * Backtest leave-one-out: untuk tiap deal tertutup dan tiap stage yang dicapainya, prediksi hasil memakai
 * statistik tanpa deal itu, lalu bandingkan dengan hasil nyata. `baseline` = probabilitas default stage.
 */
export function backtestStageModel(samples: ClosedSample[], stages: StageInfo[]): Backtest | null {
  if (samples.length === 0) return null;
  const t = tally(samples, stages);
  let points = 0;
  let hit = 0;
  let brier = 0;
  let bHit = 0;
  let bBrier = 0;
  for (const d of samples) {
    const y = d.won ? 1 : 0;
    for (const s of stages) {
      if (s.position > d.maxPos) continue;
      const c = t.get(s.position)!;
      const p = smoothedRate(c.n - 1, c.won - y, s.probability);
      const b = clampP(s.probability / 100);
      points++;
      brier += (p - y) ** 2;
      bBrier += (b - y) ** 2;
      if (p >= 0.5 === d.won) hit++;
      if (b >= 0.5 === d.won) bHit++;
    }
  }
  if (points === 0) return null;
  return {
    points,
    closedDeals: samples.length,
    accuracy: hit / points,
    brier: brier / points,
    baselineAccuracy: bHit / points,
    baselineBrier: bBrier / points,
  };
}

export type PredictionFactor = { key: string; label: string; effect: string; note: string };
export type DealSignals = {
  daysSinceTouch: number;
  /** Aktivitas selesai sejak deal masuk stage saat ini. */
  doneSinceStage: number;
  daysInStage: number;
  /** Hari menuju perkiraan closing (negatif = lewat), null bila belum diisi. */
  daysToClose: number | null;
  sentQuotations: number;
};

export type DealAdvice = {
  action: "advance" | "stay" | "review";
  targetStageId: string | null;
  title: string;
  reason: string;
};

export type DealPrediction = {
  /** Probabilitas closing 0–100 (estimasi, bukan jaminan). */
  probability: number;
  base: number;
  sample: number;
  factors: PredictionFactor[];
  advice: DealAdvice;
};

export function predictDeal(
  stage: StageInfo,
  nextStage: StageInfo | null,
  tallies: Tally,
  sig: DealSignals,
): DealPrediction {
  const c = tallies.get(stage.position) ?? { n: 0, won: 0 };
  const baseRate = smoothedRate(c.n, c.won, stage.probability);
  const factors: PredictionFactor[] = [
    {
      key: "stage",
      label: "Stage saat ini",
      effect: `${Math.round(baseRate * 100)}%`,
      note:
        c.n > 0
          ? `${c.won} dari ${c.n} deal tertutup yang mencapai "${stage.name}" berakhir Won`
          : `Belum ada riwayat — memakai probabilitas stage (${stage.probability}%)`,
    },
  ];
  let mult = 1;
  const apply = (key: string, label: string, m: number, note: string) => {
    mult *= m;
    factors.push({ key, label, effect: m > 1 ? `×${m}` : `×${m}`, note });
  };
  if (sig.daysSinceTouch <= 7 && sig.doneSinceStage >= 1)
    apply("recent", "Aktivitas baru", 1.1, `Interaksi terakhir ${sig.daysSinceTouch} hari lalu`);
  if (sig.daysSinceTouch >= 30)
    apply("stale30", "Mandek", 0.7, `Tanpa interaksi ${sig.daysSinceTouch} hari`);
  else if (sig.daysSinceTouch >= 14)
    apply("stale14", "Mulai mandek", 0.85, `Tanpa interaksi ${sig.daysSinceTouch} hari`);
  if (sig.daysToClose !== null && sig.daysToClose < 0)
    apply("overdue", "Lewat perkiraan closing", 0.85, `Terlambat ${-sig.daysToClose} hari`);
  if (sig.sentQuotations > 0)
    apply("quotation", "Quotation terkirim", 1.05, `${sig.sentQuotations} quotation sudah dikirim`);

  const probability = Math.round(Math.min(0.98, Math.max(0.01, baseRate * mult)) * 100);

  let advice: DealAdvice;
  if ((sig.daysToClose !== null && sig.daysToClose < 0) || sig.daysSinceTouch >= 30) {
    advice = {
      action: "review",
      targetStageId: null,
      title: "Tinjau deal ini",
      reason:
        sig.daysToClose !== null && sig.daysToClose < 0
          ? `Perkiraan closing sudah lewat ${-sig.daysToClose} hari. Perbarui tanggal, jadwalkan follow-up, atau tutup bila tak berlanjut.`
          : `Tanpa interaksi ${sig.daysSinceTouch} hari. Jadwalkan follow-up atau pertimbangkan menutup deal.`,
    };
  } else if (nextStage && sig.doneSinceStage >= 2 && sig.daysSinceTouch <= 7) {
    const n = tallies.get(nextStage.position);
    advice = {
      action: "advance",
      targetStageId: nextStage.id,
      title: `Pertimbangkan pindah ke "${nextStage.name}"`,
      reason: `${sig.doneSinceStage} interaksi selesai sejak masuk stage ini dan aktivitas masih baru.${
        n && n.n > 0
          ? ` Deal yang mencapai "${nextStage.name}" berakhir Won ${Math.round((n.won / n.n) * 100)}% (${n.n} deal).`
          : ""
      }`,
    };
  } else {
    advice = {
      action: "stay",
      targetStageId: null,
      title: `Tetap di "${stage.name}"`,
      reason:
        sig.doneSinceStage < 2
          ? "Belum cukup interaksi sejak masuk stage ini untuk menyarankan perpindahan."
          : "Belum ada sinyal kuat untuk berpindah stage saat ini.",
    };
  }
  return { probability, base: Math.round(baseRate * 100), sample: c.n, factors, advice };
}
