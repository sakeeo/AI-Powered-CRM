export type DealRisk = { level: "high" | "medium"; reason: string };

const DAY = 86_400_000;

/**
 * Indikator risiko deal (pasif, deterministik): deal terbuka yang mandek tanpa pembaruan padahal
 * mendekati/melewati perkiraan closing. HANYA informasi — tidak pernah mengubah stage atau data deal.
 * `lastTouchAt` = pembaruan/interaksi terakhir (plan 1.11 menambahkan aktivitas ke sini).
 */
export function dealRisk(
  deal: { status: string; expectedCloseDate: Date | string | null },
  lastTouchAt: Date,
  now = new Date(),
): DealRisk | null {
  if (deal.status !== "open") return null;
  const stale = Math.floor((now.getTime() - lastTouchAt.getTime()) / DAY);
  if (deal.expectedCloseDate) {
    const close = new Date(deal.expectedCloseDate);
    const toClose = Math.ceil((close.getTime() - now.getTime()) / DAY);
    if (toClose < 0)
      return { level: "high", reason: `Melewati perkiraan closing ${-toClose} hari` };
    if (toClose <= 14 && stale >= 7)
      return {
        level: "high",
        reason: `Closing ${toClose} hari lagi, tanpa pembaruan ${stale} hari`,
      };
    if (toClose <= 30 && stale >= 14)
      return {
        level: "medium",
        reason: `Closing ${toClose} hari lagi, tanpa pembaruan ${stale} hari`,
      };
    return null;
  }
  if (stale >= 30) return { level: "medium", reason: `Tanpa pembaruan ${stale} hari` };
  return null;
}
