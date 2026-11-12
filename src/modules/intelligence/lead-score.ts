/**
 * Skor lead (plan 3.1): murni, deterministik, dan dapat dijelaskan — setiap poin berasal dari faktor yang
 * ditampilkan ke pengguna. HANYA informasi: tidak pernah mengubah status/assignment lead.
 * Total maksimum 100 = jumlah `max` semua faktor.
 */
export type LeadScoreInput = {
  email: string | null;
  phone: string | null;
  companyName: string | null;
  needs: string | null;
  budget: number | null;
  urgency: string | null;
  status: string;
  sourceId: string | null;
  convertedAt: Date | null;
  archivedAt: Date | null;
};

export type LeadActivityStats = {
  /** Aktivitas selesai (call/meeting/email/WA/catatan/task) yang tertaut ke lead. */
  doneCount: number;
  lastTouchAt: Date | null;
};

/** Konversi historis per sumber lead (agregat org). */
export type SourceStat = { total: number; converted: number };

export type ScoreContext = {
  sourceStats: Map<string, SourceStat>;
  /** Median budget lead org (untuk menilai budget relatif); null bila data kurang. */
  medianBudget: number | null;
  now?: Date;
};

export type ScoreFactor = {
  key: string;
  label: string;
  points: number;
  max: number;
  note: string;
};

export type LeadBand = "hot" | "warm" | "cold";
export type LeadScore = { score: number; band: LeadBand; factors: ScoreFactor[] };

export const LEAD_BAND_LABEL: Record<LeadBand, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};
export const LEAD_BAND_TONE: Record<LeadBand, "red" | "orange" | "blue"> = {
  hot: "red",
  warm: "orange",
  cold: "blue",
};

/** Minimum sampel lead per sumber sebelum konversi historisnya dianggap informatif. */
export const MIN_SOURCE_SAMPLE = 5;
const DAY = 86_400_000;

export function bandOf(score: number): LeadBand {
  return score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
}

export function scoreLead(
  lead: LeadScoreInput,
  act: LeadActivityStats,
  ctx: ScoreContext,
): LeadScore | null {
  // Lead yang sudah terkonversi/diarsipkan tidak perlu dinilai lagi.
  if (lead.convertedAt || lead.archivedAt) return null;
  const now = ctx.now ?? new Date();
  const factors: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number, max: number, note: string) =>
    factors.push({ key, label, points: Math.max(0, Math.min(max, Math.round(points))), max, note });

  // 1. Kelengkapan kontak (16)
  const contact = (lead.email ? 6 : 0) + (lead.phone ? 6 : 0) + (lead.companyName ? 4 : 0);
  const missing = [
    !lead.email && "email",
    !lead.phone && "telepon",
    !lead.companyName && "perusahaan",
  ].filter(Boolean);
  add(
    "contact",
    "Kelengkapan kontak",
    contact,
    16,
    missing.length ? `Belum ada ${missing.join(", ")}` : "Email, telepon, dan perusahaan terisi",
  );

  // 2. Kebutuhan teridentifikasi (8)
  add(
    "needs",
    "Kebutuhan jelas",
    lead.needs && lead.needs.trim().length >= 10 ? 8 : 0,
    8,
    lead.needs && lead.needs.trim().length >= 10 ? "Kebutuhan dicatat" : "Kebutuhan belum dicatat",
  );

  // 3. Budget (12): terisi 8, di atas median +4
  let budgetPts = 0;
  let budgetNote = "Budget belum diketahui";
  if (lead.budget !== null && lead.budget > 0) {
    budgetPts = 8;
    budgetNote = "Budget diketahui";
    if (ctx.medianBudget !== null && lead.budget >= ctx.medianBudget) {
      budgetPts += 4;
      budgetNote = "Budget diketahui, di atas median lead lain";
    }
  }
  add("budget", "Budget", budgetPts, 12, budgetNote);

  // 4. Urgensi (14)
  const urg = { high: 14, medium: 7, low: 2 }[lead.urgency as "high"] ?? 0;
  add(
    "urgency",
    "Urgensi",
    urg,
    14,
    lead.urgency
      ? `Urgensi ${{ high: "tinggi", medium: "sedang", low: "rendah" }[lead.urgency as "high"]}`
      : "Urgensi belum dicatat",
  );

  // 5. Status kualifikasi (12)
  const st = { qualified: 12, contacted: 6, new: 0, unqualified: 0 }[lead.status as "new"] ?? 0;
  add("status", "Status kualifikasi", st, 12, `Status ${lead.status}`);

  // 6. Aktivitas (20): jumlah interaksi selesai (8) + kebaruan interaksi (12)
  const countPts = act.doneCount >= 3 ? 8 : act.doneCount === 2 ? 6 : act.doneCount === 1 ? 4 : 0;
  add(
    "interactions",
    "Interaksi tercatat",
    countPts,
    8,
    act.doneCount ? `${act.doneCount} interaksi selesai` : "Belum ada interaksi",
  );
  let recencyPts = 0;
  let recencyNote = "Belum pernah dihubungi";
  if (act.lastTouchAt) {
    const days = Math.max(0, Math.floor((now.getTime() - act.lastTouchAt.getTime()) / DAY));
    recencyPts = days <= 7 ? 12 : days <= 14 ? 8 : days <= 30 ? 4 : 0;
    recencyNote = `Interaksi terakhir ${days} hari lalu`;
  }
  add("recency", "Kebaruan interaksi", recencyPts, 12, recencyNote);

  // 7. Konversi historis sumber (18) — hanya bila sampel cukup
  const stat = lead.sourceId ? ctx.sourceStats.get(lead.sourceId) : undefined;
  if (stat && stat.total >= MIN_SOURCE_SAMPLE) {
    const rate = stat.converted / stat.total;
    add(
      "source",
      "Konversi historis sumber",
      Math.min(1, rate / 0.5) * 18,
      18,
      `${Math.round(rate * 100)}% dari ${stat.total} lead sumber ini terkonversi`,
    );
  } else {
    add(
      "source",
      "Konversi historis sumber",
      0,
      18,
      stat
        ? `Data sumber belum cukup (${stat.total}/${MIN_SOURCE_SAMPLE} lead)`
        : "Sumber belum diisi / belum ada riwayat",
    );
  }

  let score = factors.reduce((s, f) => s + f.points, 0);
  // Lead yang sudah dinyatakan tidak layak dibatasi rendah agar tidak tampil "Hot".
  if (lead.status === "unqualified") score = Math.min(score, 20);
  return { score, band: bandOf(score), factors };
}

export const LEAD_SCORE_MAX = 100;

export function median(nums: number[]): number | null {
  if (nums.length < 3) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
