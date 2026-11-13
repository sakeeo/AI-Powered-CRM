import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "@/lib/errors";
import { AI_PROVIDER_INFO, type AiProvider } from "@/modules/connectors/registry";

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return (
      l === "::1" ||
      l === "::" ||
      l.startsWith("fc") ||
      l.startsWith("fd") ||
      l.startsWith("fe80") ||
      l.startsWith("::ffff:")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Validasi base URL buatan user (cegah SSRF ke jaringan internal). Hanya https. */
export async function assertSafeBaseUrl(raw: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AppError("Base URL tidak valid");
  }
  if (u.protocol !== "https:") throw new AppError("Base URL harus memakai https://");
  if (u.username || u.password) throw new AppError("Base URL tidak boleh berisi kredensial");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new AppError("Host base URL tidak dapat dijangkau");
  if (addrs.some((a) => isPrivateIp(a.address)))
    throw new AppError("Base URL tidak boleh mengarah ke jaringan internal");
  return u.toString().replace(/\/+$/, "");
}

/** Ambil daftar model dari penyedia memakai key user. Server-side saja; key tidak dikembalikan. */
export async function fetchProviderModels(
  provider: AiProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<string[]> {
  const info = AI_PROVIDER_INFO[provider];
  const base = baseUrl ? await assertSafeBaseUrl(baseUrl) : info.defaultBaseUrl;
  if (!base) throw new AppError("Base URL wajib diisi");

  let url = `${base}/models`;
  const headers: Record<string, string> = {};
  if (provider === "gemini") {
    url = `${base}/models?pageSize=200`;
    headers["x-goog-api-key"] = apiKey;
  } else if (provider === "anthropic") {
    url = `${base}/models?limit=100`;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new AppError("Tidak dapat menghubungi penyedia");
  });
  if (res.status === 401 || res.status === 403)
    throw new AppError("API key ditolak oleh penyedia. Periksa kembali key Anda.");
  if (!res.ok) throw new AppError(`Penyedia menolak permintaan daftar model (${res.status})`);

  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string }[];
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  } | null;
  let ids: string[] = [];
  if (provider === "gemini") {
    ids = (json?.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""));
  } else {
    ids = (json?.data ?? []).map((m) => m.id ?? "");
  }
  return [...new Set(ids.filter(Boolean))].sort();
}
