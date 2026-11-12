/**
 * Identifikasi peluang repeat purchase (deterministik, tanpa AI): dari tanggal deal Won pelanggan.
 * - ≥2 pembelian: interval rata-rata → perkiraan pembelian berikutnya (terakhir + rata-rata).
 * - 1 pembelian: dianggap "satu kali" dan layak di-follow-up bila sudah lewat `oneTimeAfterDays`.
 */
export type RepeatStatus = "overdue" | "soon" | "scheduled" | "one_time_stale" | "one_time_recent";

export type RepeatAnalysis = {
  purchases: number;
  lastAt: Date;
  avgIntervalDays: number | null;
  predictedNextAt: Date | null;
  status: RepeatStatus;
  /** Hari lewat dari perkiraan (positif = terlambat) atau sejak pembelian terakhir untuk satu-kali */
  daysLate: number;
};

export const REPEAT_LABEL: Record<RepeatStatus, string> = {
  overdue: "Lewat jadwal beli",
  soon: "Segera beli ulang",
  scheduled: "Belum waktunya",
  one_time_stale: "Pembeli satu kali (lama)",
  one_time_recent: "Pembeli baru",
};
export const REPEAT_OPPORTUNITY: readonly RepeatStatus[] = ["overdue", "soon", "one_time_stale"];

const DAY = 86_400_000;

export function analyzeRepeat(
  wonDates: Date[],
  now: Date,
  opts: { oneTimeAfterDays?: number; soonDays?: number } = {},
): RepeatAnalysis | null {
  const oneTimeAfterDays = opts.oneTimeAfterDays ?? 90;
  const soonDays = opts.soonDays ?? 14;
  // Pembelian pada hari yang sama dihitung satu.
  const days = [...new Set(wonDates.map((d) => d.toISOString().slice(0, 10)))].sort();
  if (days.length === 0) return null;
  const dates = days.map((d) => new Date(`${d}T00:00:00Z`));
  const last = dates[dates.length - 1];
  if (dates.length === 1) {
    const age = Math.floor((now.getTime() - last.getTime()) / DAY);
    return {
      purchases: 1,
      lastAt: last,
      avgIntervalDays: null,
      predictedNextAt: null,
      status: age >= oneTimeAfterDays ? "one_time_stale" : "one_time_recent",
      daysLate: age,
    };
  }
  const gaps = dates.slice(1).map((d, i) => (d.getTime() - dates[i].getTime()) / DAY);
  const avg = Math.max(1, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length));
  const predicted = new Date(last.getTime() + avg * DAY);
  const late = Math.floor((now.getTime() - predicted.getTime()) / DAY);
  return {
    purchases: dates.length,
    lastAt: last,
    avgIntervalDays: avg,
    predictedNextAt: predicted,
    status: late > 0 ? "overdue" : late >= -soonDays ? "soon" : "scheduled",
    daysLate: late,
  };
}
