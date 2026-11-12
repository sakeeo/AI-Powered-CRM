import { describe, expect, it } from "vitest";
import type { StageInfo } from "@/modules/intelligence/deal-prediction";
import {
  backtestForecast,
  bucketFor,
  mulberry32,
  quantile,
  simulate,
  stageAt,
  type FDeal,
} from "@/modules/intelligence/forecast";

const stages: StageInfo[] = [
  { id: "s1", position: 1, probability: 20, name: "Baru" },
  { id: "s2", position: 2, probability: 60, name: "Proposal" },
];
const d = (iso: string) => new Date(iso);

describe("simulate", () => {
  it("deterministik (seed tetap) dan urutan P10 ≤ P50 ≤ P90 ≤ total nilai", () => {
    const deals = Array.from({ length: 20 }, (_, i) => ({
      p: 0.3 + (i % 5) * 0.1,
      value: 100 + i,
      bucket: i % 3,
    }));
    const a = simulate(deals, 3);
    const b = simulate(deals, 3);
    expect(a).toEqual(b);
    for (const r of [...a.buckets, a.total]) {
      expect(r.p10).toBeLessThanOrEqual(r.p50);
      expect(r.p50).toBeLessThanOrEqual(r.p90);
    }
    expect(a.total.p90).toBeLessThanOrEqual(deals.reduce((s, x) => s + x.value, 0));
    // nilai harapan = Σ p·v
    expect(a.total.expected).toBeCloseTo(
      deals.reduce((s, x) => s + x.p * x.value, 0),
      6,
    );
    // P50 mendekati nilai harapan (sampel besar)
    expect(Math.abs(a.total.p50 - a.total.expected) / a.total.expected).toBeLessThan(0.1);
  });
  it("probabilitas 0 → 0; probabilitas 1 → nilai penuh; tanpa deal → 0", () => {
    expect(simulate([{ p: 0, value: 500, bucket: 0 }], 1).total.p90).toBe(0);
    const full = simulate([{ p: 1, value: 500, bucket: 0 }], 1).total;
    expect([full.p10, full.p50, full.p90]).toEqual([500, 500, 500]);
    expect(simulate([], 2).total.p50).toBe(0);
  });
  it("PRNG dan quantile", () => {
    const r = mulberry32(1);
    const xs = Array.from({ length: 1000 }, r);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([10, 20], 0.5)).toBe(15);
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe("bucketFor", () => {
  const now = d("2026-11-12T00:00:00Z");
  it("bulan ini/lewat → 0; bulan depan → 1; di luar horizon & tanpa tanggal → null", () => {
    expect(bucketFor(d("2026-11-30"), now)).toBe(0);
    expect(bucketFor(d("2026-09-01"), now)).toBe(0);
    expect(bucketFor(d("2026-12-15"), now)).toBe(1);
    expect(bucketFor(d("2027-01-05"), now)).toBe(2);
    expect(bucketFor(d("2027-02-01"), now)).toBeNull();
    expect(bucketFor(null, now)).toBeNull();
  });
});

describe("stageAt & backtestForecast", () => {
  const deal = (over: Partial<FDeal>): FDeal => ({
    id: "x",
    value: 100,
    createdAt: d("2026-01-01"),
    closedAt: null,
    status: "open",
    expectedClose: null,
    stageId: "s2",
    history: [],
    ...over,
  });
  it("merekonstruksi stage pada waktu tertentu", () => {
    const x = deal({
      history: [{ fromStageId: "s1", toStageId: "s2", createdAt: d("2026-03-01") }],
    });
    expect(stageAt(x, d("2026-02-01"))).toBe("s1");
    expect(stageAt(x, d("2026-04-01"))).toBe("s2");
    expect(stageAt(deal({}), d("2026-02-01"))).toBe("s2"); // tanpa riwayat
  });

  it("backtest tanpa kebocoran: hasil bulan M tidak ikut melatih prediksi M; cakupan & MAPE terhitung", () => {
    const now = d("2026-11-12T00:00:00Z");
    const deals: FDeal[] = [];
    // Pelatihan: 12 deal tertutup Jan–Mar (8 won / 4 lost), semuanya mencapai s2
    for (let i = 0; i < 12; i++)
      deals.push(
        deal({
          id: `t${i}`,
          status: i < 8 ? "won" : "lost",
          closedAt: d(`2026-0${1 + (i % 3)}-15`),
          history: [{ fromStageId: "s1", toStageId: "s2", createdAt: d("2026-01-05") }],
        }),
      );
    // Kohort Oktober: 10 deal terbuka di s2, perkiraan closing Oktober; 6 menang di Oktober
    for (let i = 0; i < 10; i++)
      deals.push(
        deal({
          id: `o${i}`,
          createdAt: d("2026-09-01"),
          expectedClose: d("2026-10-20"),
          status: i < 6 ? "won" : "lost",
          closedAt: d("2026-10-25"),
          history: [{ fromStageId: "s1", toStageId: "s2", createdAt: d("2026-09-05") }],
        }),
      );
    const r = backtestForecast(deals, stages, now);
    const oct = r.cases.find((c) => c.month === "2026-10")!;
    expect(oct).toBeDefined();
    expect(oct.deals).toBe(10);
    expect(oct.actual).toBe(600);
    expect(oct.p10).toBeLessThanOrEqual(oct.p50);
    expect(oct.within).toBe(oct.actual >= oct.p10 && oct.actual <= oct.p90);
    expect(r.coverage).not.toBeNull();
    expect(r.mape).not.toBeNull();
    // Deal Oktober sendiri tidak ada di pelatihan Oktober (closedAt ≥ awal bulan) → bulan Sept tidak punya kohort
    expect(r.cases.find((c) => c.month === "2026-09")).toBeUndefined();
  });

  it("pelatihan kurang dari minimum → bulan dilewati", () => {
    const now = d("2026-11-12T00:00:00Z");
    expect(backtestForecast([deal({ expectedClose: d("2026-10-10") })], stages, now).cases).toEqual(
      [],
    );
  });
});
