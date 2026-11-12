import { describe, expect, it } from "vitest";
import {
  detectLeadInflowDrop,
  detectVipDrops,
  detectWinRateDrop,
  weekKey,
  type PartyActivity,
} from "@/modules/intelligence/anomalies";

const party = (over: Partial<PartyActivity>): PartyActivity => ({
  type: "company",
  id: "c1",
  name: "PT Besar",
  ownerId: null,
  total: 100,
  recent: 0,
  baseline90: 12,
  ...over,
});

describe("detectVipDrops", () => {
  it("hanya VIP (20% teratas): customer kecil dengan penurunan sama tidak diberi alert", () => {
    const parties = [
      party({ id: "vip", total: 1000 }),
      ...Array.from({ length: 4 }, (_, i) => party({ id: `s${i}`, total: 10 + i })),
    ];
    const r = detectVipDrops(parties);
    expect(r.map((a) => a.subject!.id)).toEqual(["vip"]);
    expect(r[0]).toMatchObject({ kind: "vip_activity_drop", severity: "high" });
    expect(r[0]!.detail).toMatch(/0 interaksi/);
  });
  it("tidak ada alert bila aktivitas masih wajar atau baseline terlalu kecil", () => {
    expect(detectVipDrops([party({ recent: 3, baseline90: 12 })])).toHaveLength(0); // 3 > 25% × 4
    expect(detectVipDrops([party({ recent: 0, baseline90: 4 })])).toHaveLength(0);
  });
  it("turun tajam tapi tidak nol → medium", () => {
    expect(detectVipDrops([party({ recent: 1, baseline90: 12 })])[0]!.severity).toBe("medium");
  });
  it("kosong → kosong", () => expect(detectVipDrops([])).toEqual([]));
});

describe("detectWinRateDrop & detectLeadInflowDrop", () => {
  it("win rate turun ≥ 20 poin dengan sampel cukup", () => {
    const a = detectWinRateDrop({ recentWon: 1, recentLost: 5, priorWon: 6, priorLost: 4 })!;
    expect(a.kind).toBe("win_rate_drop");
    expect(a.detail).toMatch(/17%.*60%/);
    expect(
      detectWinRateDrop({ recentWon: 1, recentLost: 2, priorWon: 6, priorLost: 4 }),
    ).toBeNull(); // sampel kecil
    expect(
      detectWinRateDrop({ recentWon: 3, recentLost: 3, priorWon: 6, priorLost: 4 }),
    ).toBeNull(); // turun 10 poin
  });
  it("aliran lead", () => {
    expect(detectLeadInflowDrop({ recent14: 2, prior56: 40 })!.kind).toBe("lead_inflow_drop"); // base 10, 2 ≤ 5
    expect(detectLeadInflowDrop({ recent14: 8, prior56: 40 })).toBeNull();
    expect(detectLeadInflowDrop({ recent14: 0, prior56: 20 })).toBeNull(); // base 5 < 8
  });
});

describe("weekKey", () => {
  it("Senin sebagai awal pekan (UTC)", () => {
    expect(weekKey(new Date("2026-11-12T10:00:00Z"))).toBe("2026-11-09"); // Kamis → Senin
    expect(weekKey(new Date("2026-11-15T23:59:00Z"))).toBe("2026-11-09"); // Minggu
    expect(weekKey(new Date("2026-11-16T00:00:00Z"))).toBe("2026-11-16");
  });
});
