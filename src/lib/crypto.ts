import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Enkripsi rahasia (API key connector) dengan AES-256-GCM.
 * Format tersimpan: `v1.<iv>.<authTag>.<ciphertext>` (base64url). IV acak 12 byte per enkripsi;
 * authTag membuat data yang diubah/ditukar terdeteksi (decrypt melempar error).
 * `aad` (mis. organizationId + tipe connector) mengikat ciphertext ke konteksnya sehingga
 * ciphertext tenant lain tidak bisa disalin-tempel dan didekripsi.
 */
const VERSION = "v1";

function masterKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plaintext: string, aad: string, key: Buffer = masterKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ct]
    .map((p, i) => (i === 0 ? p : (p as Buffer).toString("base64url")))
    .join(".");
}

export function decryptSecret(payload: string, aad: string, key: Buffer = masterKey()): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Format ciphertext tidak valid");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

/** Tampilkan kunci secara aman: `sk-...abcd`. Tidak pernah memuat bagian tengah. */
export function maskSecret(secret: string): string {
  const s = secret.trim();
  if (s.length <= 8) return "••••";
  const prefix = s.startsWith("sk-") ? "sk-" : s.slice(0, 3);
  return `${prefix}...${s.slice(-4)}`;
}
