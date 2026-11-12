import type { RoutingStrategy } from "@/modules/omnichannel/constants";

export type RoutingDecision = {
  assigneeId: string | null;
  /** true bila giliran round robin terpakai (kursor harus naik). */
  usedCursor: boolean;
  reason: "none" | "sticky_owner" | "round_robin" | "no_eligible";
};

/**
 * Pilih penerima percakapan baru. Murni agar mudah diuji.
 * - `eligible`: id anggota aktif yang boleh menerima (sudah disaring peran/aktif).
 * - `pool`: pilihan admin (kosong = semua `eligible`); disaring ke `eligible`.
 */
export function chooseAssignee(input: {
  strategy: RoutingStrategy;
  stickyOwnerId: string | null;
  pool: string[];
  cursor: number;
  eligible: string[];
}): RoutingDecision {
  const { strategy, stickyOwnerId, cursor, eligible } = input;
  if (strategy === "none") return { assigneeId: null, usedCursor: false, reason: "none" };
  const ok = new Set(eligible);
  if (strategy === "sticky_owner" && stickyOwnerId && ok.has(stickyOwnerId))
    return { assigneeId: stickyOwnerId, usedCursor: false, reason: "sticky_owner" };
  // round robin (atau fallback sticky tanpa pemilik): pool terbatas pada anggota yang layak, urut stabil.
  const chosen = (input.pool.length ? input.pool : eligible).filter((id) => ok.has(id));
  const list = [...new Set(chosen)].sort();
  if (list.length === 0) return { assigneeId: null, usedCursor: false, reason: "no_eligible" };
  return {
    assigneeId: list[((cursor % list.length) + list.length) % list.length]!,
    usedCursor: true,
    reason: "round_robin",
  };
}
