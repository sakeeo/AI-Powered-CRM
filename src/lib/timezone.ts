/** Utilitas zona waktu organisasi (IANA, mis. Asia/Jakarta) tanpa dependensi tambahan. */

/** Selisih (ms) antara waktu dinding `tz` dan UTC pada instan `at`. */
function offsetMs(at: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Waktu dinding lokal organisasi → instan UTC.
 * Menerima `YYYY-MM-DDTHH:mm` atau `YYYY-MM-DD` (tanggal saja = akhir hari 23:59, agar tugas
 * "jatuh tempo tanggal X" baru terlambat setelah hari X berakhir di zona organisasi).
 */
export function zonedToUtc(local: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) throw new Error("Format tanggal/waktu tidak valid");
  const [, y, mo, d, h = "23", mi = "59"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz); // koreksi di sekitar perubahan DST
  return new Date(t);
}

/** Tanggal kalender (YYYY-MM-DD) pada instan `at` di zona `tz`. */
export function dateInTz(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);
}

/** Awal hari ini dan awal besok (UTC) menurut zona `tz`. */
export function dayBoundsInTz(at: Date, tz: string): { start: Date; end: Date } {
  const today = dateInTz(at, tz);
  const start = zonedToUtc(`${today}T00:00`, tz);
  const next = new Date(start.getTime() + 36 * 3_600_000);
  const end = zonedToUtc(`${dateInTz(next, tz)}T00:00`, tz);
  return { start, end };
}

export function formatInTz(at: Date | string, tz: string, withTime = true): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).format(new Date(at));
}

/** Nilai untuk <input type="datetime-local"> dari instan UTC. */
export function toLocalInput(at: Date | string, tz: string): string {
  const d = new Date(at);
  return `${dateInTz(d, tz)}T${new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d)}`;
}
