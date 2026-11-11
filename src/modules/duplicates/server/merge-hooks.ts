import type { ActionContext } from "@/lib/action";

/**
 * Hook pemindahan relasi saat merge manual: modul lain (aktivitas, quotation, dst.) mendaftarkan
 * fungsi yang memindahkan record dari `from` ke `to` di dalam transaksi yang sama.
 */
export type Reassign = (tx: ActionContext["db"], from: string, to: string) => Promise<void>;
export const contactMergeHooks: Reassign[] = [];
export const leadMergeHooks: Reassign[] = [];
export const companyMergeHooks: Reassign[] = [];
