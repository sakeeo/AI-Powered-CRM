import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

const key = randomBytes(32);
const SECRET = "sk-test-1234567890abcdef";

describe("crypto AES-256-GCM", () => {
  it("round-trip", () => {
    const enc = encryptSecret(SECRET, "org-1:ai_openai", key);
    expect(enc).not.toContain(SECRET);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptSecret(enc, "org-1:ai_openai", key)).toBe(SECRET);
  });

  it("IV acak: enkripsi dua kali menghasilkan ciphertext berbeda", () => {
    expect(encryptSecret(SECRET, "a", key)).not.toBe(encryptSecret(SECRET, "a", key));
  });

  it("deteksi tampering pada ciphertext, tag, dan IV", () => {
    const [v, iv, tag, ct] = encryptSecret(SECRET, "a", key).split(".");
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64url");
      buf[0] ^= 1;
      return buf.toString("base64url");
    };
    expect(() => decryptSecret([v, iv, tag, flip(ct)].join("."), "a", key)).toThrow();
    expect(() => decryptSecret([v, iv, flip(tag), ct].join("."), "a", key)).toThrow();
    expect(() => decryptSecret([v, flip(iv), tag, ct].join("."), "a", key)).toThrow();
  });

  it("AAD berbeda (tenant/connector lain) gagal didekripsi", () => {
    const enc = encryptSecret(SECRET, "org-1:ai_openai", key);
    expect(() => decryptSecret(enc, "org-2:ai_openai", key)).toThrow();
  });

  it("kunci berbeda gagal; format salah ditolak", () => {
    const enc = encryptSecret(SECRET, "a", key);
    expect(() => decryptSecret(enc, "a", randomBytes(32))).toThrow();
    expect(() => decryptSecret("bukan-ciphertext", "a", key)).toThrow();
  });

  it("maskSecret tidak membocorkan bagian tengah", () => {
    expect(maskSecret(SECRET)).toBe("sk-...cdef");
    expect(maskSecret("AIzaSyABCDEFGHIJKL")).toBe("AIz...IJKL");
    expect(maskSecret("short")).toBe("••••");
  });
});
