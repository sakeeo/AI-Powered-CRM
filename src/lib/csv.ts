/**
 * Netralkan CSV/formula injection: sel yang diawali = + - @ (atau tab/CR) akan dieksekusi
 * sebagai formula oleh Excel/Sheets. Awali dengan apostrof agar dibaca sebagai teks.
 */
export function safeCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return value;
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
