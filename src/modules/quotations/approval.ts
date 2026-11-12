import Decimal from "decimal.js";

export const APPROVAL_STATUSES = ["none", "pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  none: "Belum diajukan",
  pending: "Menunggu persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

/** Peran yang boleh menyetujui (Sales Manager tidak boleh menyetujui pengajuannya sendiri). */
export const APPROVER_ROLES = ["owner", "admin", "sales_manager"] as const;

/** Perlu approval bila ambang diatur dan total ≥ ambang. Perbandingan Decimal (tanpa float). */
export function requiresApproval(total: string, threshold: string | null | undefined): boolean {
  if (threshold === null || threshold === undefined || threshold === "") return false;
  return new Decimal(total).gte(threshold);
}

export function canDecide(opts: { role: string; userId: string; requestedBy: string | null }) {
  if (!(APPROVER_ROLES as readonly string[]).includes(opts.role)) return false;
  if (opts.role === "sales_manager" && opts.requestedBy === opts.userId) return false;
  return true;
}
