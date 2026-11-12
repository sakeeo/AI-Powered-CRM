import { describe, expect, it } from "vitest";
import { bandOf, scoreLead, type LeadScoreInput } from "@/modules/intelligence/lead-score";
import { evaluateQuality, type QualityMetrics } from "@/modules/intelligence/quality";

const NOW = new Date("2026-11-12T00:00:00Z");
const base: LeadScoreInput = {
  email: null,
  phone: null,
  companyName: null,
  needs: null,
  budget: null,
  urgency: null,
  status: "new",
  sourceId: null,
  convertedAt: null,
  archivedAt: null,
};
const ctx = { sourceStats: new Map(), medianBudget: null, now: NOW };
const none = { doneCount: 0, lastTouchAt: null };

describe("scoreLead", () => {
  it("lead kosong = 0 (Cold) dan semua faktor punya penjelasan", () => {
    const r = scoreLead(base, none, ctx)!;
    expect(r.score).toBe(0);
    expect(r.band).toBe("cold");
    expect(r.factors.length).toBe(8);
    expect(r.factors.every((f) => f.note.length > 0)).toBe(true);
    expect(r.factors.reduce((s, f) => s + f.max, 0)).toBe(100);
  });

  it("lead lengkap, urgen, qualified, baru dihubungi, sumber bagus = Hot dan maksimal 100", () => {
    const r = scoreLead(
      {
        ...base,
        email: "a@b.co",
        phone: "0812",
        companyName: "PT X",
        needs: "Butuh sistem kasir untuk 3 cabang",
        budget: 50_000_000,
        urgency: "high",
        status: "qualified",
        sourceId: "s1",
      },
      { doneCount: 4, lastTouchAt: new Date("2026-11-10T00:00:00Z") },
      {
        ...ctx,
        medianBudget: 10_000_000,
        sourceStats: new Map([["s1", { total: 10, converted: 6 }]]),
      },
    )!;
    expect(r.score).toBe(100);
    expect(r.band).toBe("hot");
  });

  it("sumber dengan sampel kecil tidak memberi poin; sampel cukup memberi poin proporsional", () => {
    const small = scoreLead({ ...base, sourceId: "s" }, none, {
      ...ctx,
      sourceStats: new Map([["s", { total: 3, converted: 3 }]]),
    })!;
    expect(small.factors.find((f) => f.key === "source")!.points).toBe(0);
    const ok = scoreLead({ ...base, sourceId: "s" }, none, {
      ...ctx,
      sourceStats: new Map([["s", { total: 10, converted: 2 }]]),
    })!;
    expect(ok.factors.find((f) => f.key === "source")!.points).toBe(7); // 20%/50%*18
  });

  it("kebaruan interaksi menurun seiring waktu", () => {
    const pts = (days: number) =>
      scoreLead(
        base,
        { doneCount: 1, lastTouchAt: new Date(NOW.getTime() - days * 86_400_000) },
        ctx,
      )!.factors.find((f) => f.key === "recency")!.points;
    expect([pts(1), pts(10), pts(20), pts(60)]).toEqual([12, 8, 4, 0]);
  });

  it("unqualified dibatasi ≤ 20; terkonversi/arsip tidak dinilai", () => {
    const r = scoreLead(
      {
        ...base,
        email: "a@b.co",
        phone: "1",
        companyName: "x",
        urgency: "high",
        status: "unqualified",
      },
      { doneCount: 5, lastTouchAt: NOW },
      ctx,
    )!;
    expect(r.score).toBeLessThanOrEqual(20);
    expect(scoreLead({ ...base, convertedAt: NOW }, none, ctx)).toBeNull();
    expect(scoreLead({ ...base, archivedAt: NOW }, none, ctx)).toBeNull();
  });

  it("batas band", () => {
    expect([bandOf(39), bandOf(40), bandOf(69), bandOf(70)]).toEqual([
      "cold",
      "warm",
      "warm",
      "hot",
    ]);
  });
});

describe("evaluateQuality", () => {
  const m: QualityMetrics = {
    leads: 30,
    leadsWithContact: 25,
    leadsWithSource: 20,
    leadsConverted: 5,
    dealsWon: 8,
    dealsLost: 6,
    closedWithHistory: 10,
    closedMonths: 4,
    activities90d: 50,
    customers: 5,
  };
  it("semua fitur siap bila ambang terpenuhi", () => {
    const r = evaluateQuality(m);
    expect(Object.values(r).every((x) => x.ready)).toBe(true);
  });
  it("fitur prediktif nonaktif dengan alasan bila data kurang", () => {
    const r = evaluateQuality({ ...m, dealsLost: 1, closedMonths: 1, leads: 5 });
    expect(r.dealPrediction.ready).toBe(false);
    expect(r.dealPrediction.reasons.join(" ")).toMatch(/Lost/);
    expect(r.forecast.ready).toBe(false);
    expect(r.leadScoring.ready).toBe(false);
  });
});
