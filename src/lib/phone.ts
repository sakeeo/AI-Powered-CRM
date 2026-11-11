/**
 * Normalisasi nomor telepon untuk pencocokan duplikat: hanya digit; awalan 0 → 62 (Indonesia).
 * Hanya untuk pembandingan — nilai asli tetap disimpan apa adanya.
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length < 6) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  return d;
}
