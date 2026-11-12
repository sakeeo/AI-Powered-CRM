import { describe, expect, it } from "vitest";
import {
  backtestStageModel,
  predictDeal,
  tally,
  type ClosedSample,
  type DealSignals,
  type StageInfo,
} from "@/modules/intelligence/deal-prediction";

const stages: StageInfo[] = [
  { id: "a", position: 1, probability: 10, name: "Baru" },
  { id: "b", position: 2, probability: 40, name: "Proposal" },
  { id: "c", position: 3, probability: 70, name: "Negosiasi" },
];
const sig = (over: Partial<DealSignals> = {}): DealSignals => ({
  daysSinceTouch: 2,
  doneSinceStage: 0,
  daysInStage: 3,
  daysToClose: 20,
  sentQuotations: 0,
  ...over,
});
// 10 deal: yang mencapai stage 3 menang 4/5; yang berhenti di stage 1 menang 0/3; stage 2: 1/2
const samples: ClosedSample[] = [
  ...Array.from({ length: 4 }, () => ({ won: true, maxPos: 3 })),
  { won: false, maxPos: 3 },
  ...Array.from({ length: 3 }, () => ({ won: false, maxPos: 1 })),
  { won: true, maxPos: 2 },
  { won: false, maxPos: 2 },
];

describe("predictDeal", () => {
  it("probabilitas dasar mengikuti win rate historis (dihaluskan prior) dan menjelaskan faktor", () => {
    const t = tally(samples, stages);
    const p = predictDeal(stages[2]!, null, t, sig());
    // stage 3: 4 won dari 5, prior 0.7 bobot 4 → (4+2.8)/(5+4) = 0.755
    expect(p.base).toBe(76);
    expect(p.probability).toBe(76);
    expect(p.sample).toBe(5);
    expect(p.factors[0]!.note).toMatch(/4 dari 5/);
  });

  it("tanpa riwayat memakai probabilitas stage", () => {
    const p = predictDeal(stages[1]!, null, tally([], stages), sig());
    expect(p.base).toBe(40);
    expect(p.factors[0]!.note).toMatch(/Belum ada riwayat/);
  });

  it("sinyal menyesuaikan: mandek menurunkan, aktivitas baru + quotation menaikkan", () => {
    const t = tally([], stages);
    const base = predictDeal(stages[1]!, null, t, sig()).probability;
    const stale = predictDeal(stages[1]!, null, t, sig({ daysSinceTouch: 35 })).probability;
    const hot = predictDeal(
      stages[1]!,
      null,
      t,
      sig({ doneSinceStage: 3, sentQuotations: 1 }),
    ).probability;
    expect(stale).toBeLessThan(base);
    expect(hot).toBeGreaterThan(base);
    expect(stale).toBeGreaterThanOrEqual(1);
  });

  it("saran: advance bila interaksi cukup & baru; review bila lewat closing/mandek; selain itu stay", () => {
    const t = tally(samples, stages);
    const adv = predictDeal(stages[0]!, stages[1]!, t, sig({ doneSinceStage: 2 })).advice;
    expect(adv).toMatchObject({ action: "advance", targetStageId: "b" });
    expect(adv.reason).toMatch(/Won 71%/);
    expect(predictDeal(stages[0]!, stages[1]!, t, sig({ daysToClose: -5 })).advice.action).toBe(
      "review",
    );
    expect(predictDeal(stages[0]!, stages[1]!, t, sig({ daysSinceTouch: 40 })).advice.action).toBe(
      "review",
    );
    const stay = predictDeal(stages[0]!, stages[1]!, t, sig({ doneSinceStage: 1 })).advice;
    expect(stay).toMatchObject({ action: "stay", targetStageId: null });
  });
});

describe("backtestStageModel", () => {
  it("mengukur akurasi leave-one-out dan membandingkan dengan baseline", () => {
    const r = backtestStageModel(samples, stages)!;
    expect(r.closedDeals).toBe(10);
    expect(r.points).toBeGreaterThan(10);
    expect(r.accuracy).toBeGreaterThan(0.5);
    expect(r.brier).toBeGreaterThan(0);
    expect(r.brier).toBeLessThan(0.3);
    expect(r.baselineBrier).toBeGreaterThan(0);
  });
  it("tidak bocor: satu deal tidak ikut memprediksi dirinya sendiri", () => {
    // Satu deal Won mencapai stage 3 sendirian: prediksi LOO memakai n=0 → prior (70%) bukan 100%.
    const r = backtestStageModel([{ won: true, maxPos: 3 }], stages)!;
    expect(r.points).toBe(3);
    expect(r.brier).toBeCloseTo(0.42, 2);
  });
  it("kosong → null", () => expect(backtestStageModel([], stages)).toBeNull());
});
