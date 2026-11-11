import { describe, expect, it } from "vitest";
import { dayBoundsInTz, formatInTz, toLocalInput, zonedToUtc } from "@/lib/timezone";
import { sanitizeRichText } from "@/lib/sanitize";

describe("zona waktu organisasi", () => {
  it("waktu dinding → UTC mengikuti offset zona (WIB +7, WITA +8, tanpa DST)", () => {
    expect(zonedToUtc("2026-11-11T09:00", "Asia/Jakarta").toISOString()).toBe(
      "2026-11-11T02:00:00.000Z",
    );
    expect(zonedToUtc("2026-11-11T09:00", "Asia/Makassar").toISOString()).toBe(
      "2026-11-11T01:00:00.000Z",
    );
  });
  it("tanggal saja = akhir hari di zona organisasi", () => {
    expect(zonedToUtc("2026-11-11", "Asia/Jakarta").toISOString()).toBe("2026-11-11T16:59:00.000Z");
  });
  it("menangani DST (New York musim panas −4, dingin −5)", () => {
    expect(zonedToUtc("2026-07-01T12:00", "America/New_York").toISOString()).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(zonedToUtc("2026-12-01T12:00", "America/New_York").toISOString()).toBe(
      "2026-12-01T17:00:00.000Z",
    );
  });
  it("batas hari & format lokal konsisten (WIB, lewat tengah malam UTC)", () => {
    const at = new Date("2026-11-11T20:00:00Z"); // 12 Nov 03:00 WIB
    const { start, end } = dayBoundsInTz(at, "Asia/Jakarta");
    expect(start.toISOString()).toBe("2026-11-11T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-12T17:00:00.000Z");
    expect(toLocalInput(at, "Asia/Jakarta")).toBe("2026-11-12T03:00");
    expect(formatInTz(at, "Asia/Jakarta")).toContain("12");
    expect(() => zonedToUtc("bukan tanggal", "Asia/Jakarta")).toThrow();
  });
});

describe("sanitizeRichText", () => {
  it("membuang script, handler, dan skema berbahaya; mempertahankan format dasar", () => {
    const out = sanitizeRichText(
      '<p onclick="x()">Halo <strong>dunia</strong></p><script>alert(1)</script><a href="javascript:alert(1)">klik</a><a href="https://ok.com">ok</a><img src=x onerror=alert(1)>',
    );
    expect(out).toContain("<strong>dunia</strong>");
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(out).toContain('href="https://ok.com"');
    expect(out).toContain("noopener");
  });
});
