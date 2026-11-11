/** Daftar zona waktu IANA dari runtime (fallback minimal bila tidak didukung). */
export function timezoneOptions(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const list = fn ? fn("timeZone") : [];
  return list.length ? list : ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC"];
}
