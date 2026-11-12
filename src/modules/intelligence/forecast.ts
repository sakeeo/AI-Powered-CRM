import {
  smoothedRate,
  tally,
  type ClosedSample,
  type StageInfo,
} from "@/modules/intelligence/deal-prediction";

/**
 * Forecast penjualan probabilistik (plan 3.5) — ESTIMASI, bukan jaminan dan bukan angka akuntansi.
 *
 * Metode: simulasi Monte Carlo (PRNG ber-seed → hasil deterministik). Tiap deal terbuka menang dengan
 * probabilitas p (win rate historis stage, dihaluskan prior) bernilai `value`; deal dikelompokkan ke bulan
 * perkiraan closing-nya. Jumlah nilai deal yang menang per percobaan → distribusi → P10/P50/P90.
 * Nilai memakai Number (cukup untuk estimasi); angka resmi tetap dari laporan berbasis Decimal.
 */
export const TRIALS = 2000;
export const HORIZON_MONTHS = 3;
export const SEED = 20261112;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export type BucketDeal = { p: number; value: number; bucket: number };
export type Range = { p10: number; p50: number; p90: number; expected: number };

/** Simulasikan `buckets` kelompok waktu sekaligus (satu PRNG → konsisten antar bucket & total). */
export function simulate(
  deals: BucketDeal[],
  buckets: number,
  trials = TRIALS,
  seed = SEED,
): { buckets: Range[]; total: Range } {
  const rnd = mulberry32(seed);
  const sums: number[][] = Array.from({ length: buckets }, () => []);
  const totals: number[] = [];
  for (let t = 0; t < trials; t++) {
    const s = new Array<number>(buckets).fill(0);
    for (const d of deals) if (rnd() < d.p) s[d.bucket]! += d.value;
    s.forEach((v, i) => sums[i]!.push(v));
    totals.push(s.reduce((a, b) => a + b, 0));
  }
  const expected = new Array<number>(buckets).fill(0);
  for (const d of deals) expected[d.bucket]! += d.p * d.value;
  const range = (xs: number[], e: number): Range => {
    const sorted = [...xs].sort((a, b) => a - b);
    return {
      p10: quantile(sorted, 0.1),
      p50: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9),
      expected: e,
    };
  };
  return {
    buckets: sums.map((x, i) => range(x, expected[i]!)),
    total: range(
      totals,
      expected.reduce((a, b) => a + b, 0),
    ),
  };
}

export const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
export const monthStart = (idx: number) => new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1));
export const monthLabel = (idx: number) => monthStart(idx).toISOString().slice(0, 7);

/** Bucket bulan untuk deal: lewat tanggal → bulan ini; di luar horizon / tanpa tanggal → null (tidak diperkirakan). */
export function bucketFor(expectedClose: Date | null, now: Date, horizon = HORIZON_MONTHS) {
  if (!expectedClose) return null;
  const diff = monthIndex(expectedClose) - monthIndex(now);
  if (diff >= horizon) return null;
  return Math.max(0, diff);
}

export type FDeal = {
  id: string;
  value: number;
  createdAt: Date;
  closedAt: Date | null;
  status: "open" | "won" | "lost";
  expectedClose: Date | null;
  stageId: string;
  history: { fromStageId: string | null; toStageId: string; createdAt: Date }[];
};

/** Stage deal pada waktu `t` (direkonstruksi dari riwayat perpindahan). */
export function stageAt(d: FDeal, t: Date): string {
  const hist = [...d.history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const past = hist.filter((h) => h.createdAt <= t);
  if (past.length) return past[past.length - 1]!.toStageId;
  if (hist.length) return hist[0]!.fromStageId ?? hist[0]!.toStageId;
  return d.stageId;
}

export function samplesOf(deals: FDeal[], stages: StageInfo[]): ClosedSample[] {
  const pos = new Map(stages.map((s) => [s.id, s.position]));
  return deals
    .filter((d) => d.status !== "open")
    .map((d) => {
      const ids = [d.stageId, ...d.history.flatMap((h) => [h.fromStageId, h.toStageId])];
      return {
        won: d.status === "won",
        maxPos: Math.max(...ids.map((i) => (i ? (pos.get(i) ?? 0) : 0))),
      };
    });
}

/** Probabilitas menang berbasis stage untuk deal pada stage `stageId`. */
export function stageProbability(
  stageId: string,
  stages: StageInfo[],
  t: ReturnType<typeof tally>,
): number {
  const s = stages.find((x) => x.id === stageId);
  if (!s) return 0.1;
  const c = t.get(s.position) ?? { n: 0, won: 0 };
  return smoothedRate(c.n, c.won, s.probability);
}

export type BacktestCase = {
  month: string;
  deals: number;
  p10: number;
  p50: number;
  p90: number;
  expected: number;
  actual: number;
  within: boolean;
};
export type ForecastBacktest = {
  cases: BacktestCase[];
  /** Persentase bulan dengan hasil aktual di dalam [P10, P90] (ideal ≈ 80%). */
  coverage: number | null;
  /** Rata-rata |P50 − aktual| / aktual (hanya bulan dengan aktual > 0). */
  mape: number | null;
};

/**
 * Backtest: untuk tiap bulan lalu M, rekonstruksi deal yang TERBUKA di awal M dan berperkiraan closing di M,
 * dengan probabilitas dari deal yang sudah tertutup SEBELUM awal M (tanpa kebocoran) dan stage pada awal M.
 * Aktual = nilai deal-deal itu yang Won sebelum akhir M.
 */
export function backtestForecast(
  deals: FDeal[],
  stages: StageInfo[],
  now: Date,
  months = 6,
  minTrainingDeals = 5,
  /** Batasi kohort yang dievaluasi (mis. deal dalam izin pengguna); pelatihan tetap memakai semua `deals`. */
  cohortIds?: Set<string>,
): ForecastBacktest {
  const cases: BacktestCase[] = [];
  for (let k = months; k >= 1; k--) {
    const idx = monthIndex(now) - k;
    const start = monthStart(idx);
    const end = monthStart(idx + 1);
    const training = samplesOf(
      deals.filter((d) => d.closedAt && d.closedAt < start),
      stages,
    );
    if (training.length < minTrainingDeals) continue;
    const t = tally(training, stages);
    const cohort = deals.filter(
      (d) =>
        (!cohortIds || cohortIds.has(d.id)) &&
        d.createdAt < start &&
        (!d.closedAt || d.closedAt >= start) &&
        d.expectedClose &&
        monthIndex(d.expectedClose) === idx,
    );
    if (cohort.length === 0) continue;
    const sim = simulate(
      cohort.map((d) => ({
        p: stageProbability(stageAt(d, start), stages, t),
        value: d.value,
        bucket: 0,
      })),
      1,
    );
    const r = sim.buckets[0]!;
    const actual = cohort
      .filter((d) => d.status === "won" && d.closedAt && d.closedAt < end)
      .reduce((s, d) => s + d.value, 0);
    cases.push({
      month: monthLabel(idx),
      deals: cohort.length,
      ...r,
      actual,
      within: actual >= r.p10 && actual <= r.p90,
    });
  }
  const pos = cases.filter((c) => c.actual > 0);
  return {
    cases,
    coverage: cases.length ? cases.filter((c) => c.within).length / cases.length : null,
    mape: pos.length
      ? pos.reduce((s, c) => s + Math.abs(c.p50 - c.actual) / c.actual, 0) / pos.length
      : null,
  };
}
