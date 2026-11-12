import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Alamat privat/loopback/link-local/metadata yang tidak boleh dijangkau fetch server-side. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (
      v === "::1" ||
      v === "::" ||
      v.startsWith("fe80") ||
      v.startsWith("fc") ||
      v.startsWith("fd")
    )
      return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/**
 * Pastikan URL tujuan (diisi pengguna, mis. gateway kustom/webhook keluar) memakai HTTPS dan
 * hanya me-resolve ke IP publik — mencegah SSRF ke jaringan internal / metadata cloud.
 * Pengecualian pengembangan: `ALLOW_PRIVATE_WEBHOOK_TARGETS=1` (tidak dipakai di production).
 */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL tidak valid");
  }
  if (url.protocol !== "https:") throw new Error("URL harus memakai HTTPS");
  if (url.username || url.password) throw new Error("URL tidak boleh memuat kredensial");
  if (process.env.ALLOW_PRIVATE_WEBHOOK_TARGETS === "1") return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error("Host tidak dapat di-resolve");
      });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address)))
    throw new Error("Alamat tujuan tidak diizinkan (jaringan privat)");
  return url;
}
