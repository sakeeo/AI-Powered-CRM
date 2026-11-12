import { assertPublicHttpsUrl } from "@/lib/ssrf";
import type { WaProvider } from "@/modules/whatsapp/constants";

/** Konfigurasi gateway (didekripsi dari TenantConnector). Rahasia tidak pernah dikirim ke client. */
export type WaConfig = {
  provider: WaProvider;
  token: string;
  apiUrl?: string;
};

export type SendResult = { ok: true; externalId?: string } | { ok: false; error: string };

const TIMEOUT_MS = 10_000;

async function post(url: string, init: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });
}

const clip = (s: string) => s.slice(0, 200);

/** Kirim satu pesan teks lewat gateway. Tidak melempar — hasil dikembalikan agar bisa dicatat. */
export async function sendViaGateway(
  cfg: WaConfig,
  to: string,
  message: string,
): Promise<SendResult> {
  try {
    if (cfg.provider === "fonnte") {
      const res = await post("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: cfg.token, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ target: to, message }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: boolean;
        reason?: string;
        id?: string[] | string;
      };
      if (!res.ok || json.status === false)
        return { ok: false, error: clip(json.reason ?? `Gateway menolak (HTTP ${res.status})`) };
      const id = Array.isArray(json.id) ? json.id[0] : json.id;
      return { ok: true, externalId: id };
    }
    const url = await assertPublicHttpsUrl(cfg.apiUrl ?? "");
    const res = await post(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok)
      return { ok: false, error: clip(json.error ?? `Gateway menolak (HTTP ${res.status})`) };
    return { ok: true, externalId: json.id };
  } catch (err) {
    return { ok: false, error: clip((err as Error).message || "Gagal menghubungi gateway") };
  }
}

/** Test koneksi tanpa mengirim pesan ke pelanggan. */
export async function testGateway(
  cfg: WaConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (cfg.provider === "fonnte") {
      const res = await post("https://api.fonnte.com/device", {
        method: "POST",
        headers: { Authorization: cfg.token },
      });
      const json = (await res.json().catch(() => ({}))) as { status?: boolean; reason?: string };
      if (!res.ok || json.status === false)
        return { ok: false, error: clip(json.reason ?? "Token ditolak") };
      return { ok: true };
    }
    const url = await assertPublicHttpsUrl(cfg.apiUrl ?? "");
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    // Gateway yang hidup menjawab (meski 404/405 untuk HEAD); 401/403 = token ditolak; 5xx = bermasalah.
    if (res.status === 401 || res.status === 403)
      return { ok: false, error: "Token ditolak gateway" };
    if (res.status >= 500) return { ok: false, error: `Gateway error (HTTP ${res.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: clip((err as Error).message || "Gagal menghubungi gateway") };
  }
}

export type InboundMessage = {
  from: string;
  body: string;
  name?: string;
  externalId?: string;
};

const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined;

/**
 * Normalisasi payload webhook gateway (Fonnte: sender/message/name/id; generik: from/message|text/name/id).
 * Hanya pesan teks; tipe lain atau pesan tanpa pengirim/isi ditolak.
 */
export function parseInbound(json: unknown): InboundMessage | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const from = str(o.sender) ?? str(o.from) ?? str(o.phone);
  const body = str(o.message) ?? str(o.text) ?? str(o.body);
  if (!from || !body || !/\d{6,}/.test(from)) return null;
  return {
    from,
    body: body.slice(0, 4000),
    name: (str(o.name) ?? str(o.pushname))?.slice(0, 120),
    externalId: (str(o.id) ?? str(o.messageId))?.slice(0, 200),
  };
}
