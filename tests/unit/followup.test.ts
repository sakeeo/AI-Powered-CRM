import { describe, expect, it } from "vitest";
import {
  acceptanceRate,
  recommendFollowUp,
  type FollowUpChannel,
  type Interaction,
} from "@/modules/intelligence/followup";

const TZ = "Asia/Jakarta"; // UTC+7
// Rabu 2026-11-11 10:00 WIB = 03:00Z
const at = (iso: string) => new Date(iso);
const wa = (iso: string, inbound = false): Interaction => ({
  channel: "whatsapp",
  at: at(iso),
  inbound,
});
const call = (iso: string): Interaction => ({ channel: "call", at: at(iso), inbound: false });
const NOW = at("2026-11-12T01:00:00Z"); // Kamis 08:00 WIB

describe("recommendFollowUp", () => {
  it("tanpa pola: basis none, kanal null, draf generik, waktu besok 10:00 lokal", () => {
    const r = recommendFollowUp({ name: "Budi", party: [], org: [], now: NOW, timezone: TZ });
    expect(r.basis).toBe("none");
    expect(r.channel).toBeNull();
    expect(r.suggestedAt.toISOString()).toBe("2026-11-13T03:00:00.000Z");
    expect(r.rationale[0]).toMatch(/Belum cukup pola/);
    expect(r.draft.body).toContain("Budi");
  });

  it("pola pelanggan: kanal berbobot (pesan masuk 2×), hari & jam dominan, kadens", () => {
    // 3 Rabu pukul 10:00 WIB (call ×1, WA masuk ×2 → WA menang berbobot 4 vs 1)
    const party = [
      call("2026-10-14T03:00:00Z"),
      wa("2026-10-21T03:00:00Z", true),
      wa("2026-10-28T03:00:00Z", true),
      wa("2026-11-04T03:00:00Z"),
    ];
    const r = recommendFollowUp({ name: "Budi", party, org: [], now: NOW, timezone: TZ });
    expect(r.basis).toBe("party");
    expect(r.channel).toBe("whatsapp");
    expect(r.weekday).toBe(3);
    expect(r.hour).toBe(10);
    expect(r.cadenceDays).toBe(7);
    // interaksi terakhir 4 Nov + 7 hari = 11 Nov (lewat), earliest = now+1j → Rabu berikutnya 18 Nov 10:00 WIB
    expect(r.suggestedAt.toISOString()).toBe("2026-11-18T03:00:00.000Z");
    expect(r.draft.body).toMatch(/Halo Budi/);
    expect(r.rationale.join(" ")).toMatch(/Rabu/);
  });

  it("sampel pelanggan kurang → pakai pola organisasi bila cukup", () => {
    const org: Interaction[] = Array.from({ length: 12 }, (_, i) => ({
      channel: (i % 4 === 0 ? "email" : "call") as FollowUpChannel,
      at: at(`2026-10-${String(1 + i).padStart(2, "0")}T07:00:00Z`),
      inbound: false,
    }));
    const r = recommendFollowUp({
      name: "Siti",
      party: [call("2026-11-01T03:00:00Z")],
      org,
      now: NOW,
      timezone: TZ,
    });
    expect(r.basis).toBe("org");
    expect(r.channel).toBe("call");
    expect(r.rationale[0]).toMatch(/seluruh organisasi/);
  });

  it("jam disarankan dibatasi jam kerja 08–17", () => {
    const night = [0, 1, 2].map((i) => call(`2026-11-0${i + 2}T20:00:00Z`)); // 03:00 WIB
    const r = recommendFollowUp({ name: "X", party: night, org: [], now: NOW, timezone: TZ });
    expect(r.hour).toBe(8);
  });

  it("acceptanceRate", () => {
    expect(acceptanceRate(0, 0)).toBeNull();
    expect(acceptanceRate(3, 1)).toBe(0.75);
  });
});
