import { describe, expect, it } from "vitest";
import { computeNextRun } from "@/lib/report-schedule";
import {
  describeRules,
  matchesRules,
  segmentRulesSchema,
  type RuleSubject,
} from "@/modules/customers/segment-rules";

const T1 = "11111111-1111-4111-8111-111111111111";
const T9 = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-15T00:00:00Z");
const subj = (over: Partial<RuleSubject> = {}): RuleSubject => ({
  type: "company",
  wonCount: 3,
  totals: { IDR: "5000000.00", USD: "99999.00" },
  lastWonAt: new Date("2026-06-01T00:00:00Z"),
  tagIds: new Set([T1]),
  ...over,
});
const rules = (r: Record<string, unknown>) => segmentRulesSchema.parse({ party: "all", ...r });
const ok = (s: RuleSubject, r: Record<string, unknown>) =>
  matchesRules(s, rules(r), { defaultCurrency: "IDR", now });

describe("aturan segmen dinamis", () => {
  it("nilai memakai mata uang default saja; batas inklusif", () => {
    expect(ok(subj(), { minTotal: 5_000_000 })).toBe(true);
    expect(ok(subj(), { minTotal: 5_000_001 })).toBe(false);
    expect(ok(subj(), { maxTotal: 5_000_000 })).toBe(true);
    expect(ok(subj({ totals: { USD: "1000000.00" } }), { minTotal: 1 })).toBe(false);
  });
  it("recency: membeli dalam N hari / tidak membeli ≥ N hari", () => {
    expect(ok(subj(), { wonWithinDays: 14 })).toBe(true); // 14 hari lalu
    expect(ok(subj(), { wonWithinDays: 13 })).toBe(false);
    expect(ok(subj(), { inactiveDays: 14 })).toBe(true);
    expect(ok(subj(), { inactiveDays: 15 })).toBe(false);
    expect(ok(subj({ lastWonAt: null }), { wonWithinDays: 365 })).toBe(false);
    expect(ok(subj({ lastWonAt: null }), { inactiveDays: 365 })).toBe(true);
  });
  it("jumlah deal, jenis, dan tag (salah satu) digabung dengan AND", () => {
    expect(ok(subj(), { minWonCount: 3, party: "company", tagIds: [T1, T9] })).toBe(true);
    expect(ok(subj(), { minWonCount: 4 })).toBe(false);
    expect(ok(subj(), { party: "contact" })).toBe(false);
    expect(ok(subj(), { tagIds: [T9] })).toBe(false);
    expect(ok(subj(), { minTotal: 1, tagIds: [T9] })).toBe(false);
  });
  it("skema menolak aturan kosong, rentang terbalik, recency ganda, properti asing", () => {
    const bad = [
      {},
      { minTotal: 10, maxTotal: 5 },
      { wonWithinDays: 5, inactiveDays: 5 },
      { minTotal: 1, organizationId: "x" },
      { minTotal: -1 },
      { tagIds: ["bukan-uuid"] },
    ];
    for (const b of bad)
      expect(segmentRulesSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
    expect(describeRules(rules({ minTotal: 1000, inactiveDays: 90 }))).toContain(
      "tidak membeli ≥ 90 hari",
    );
  });
});

describe("computeNextRun (zona waktu organisasi)", () => {
  const WIB = "Asia/Jakarta";
  it("harian: hari ini bila jam belum lewat, besok bila sudah", () => {
    // 2026-06-15 00:00Z = 07:00 WIB → jam 08:00 WIB hari ini = 01:00Z
    expect(
      computeNextRun(
        { frequency: "daily", weekday: null, monthday: null, hour: 8 },
        now,
        WIB,
      )!.toISOString(),
    ).toBe("2026-06-15T01:00:00.000Z");
    expect(
      computeNextRun(
        { frequency: "daily", weekday: null, monthday: null, hour: 6 },
        now,
        WIB,
      )!.toISOString(),
    ).toBe("2026-06-15T23:00:00.000Z");
  });
  it("mingguan & bulanan; none → null", () => {
    // 15 Juni 2026 = Senin. Rabu (3) → 17 Juni.
    expect(
      computeNextRun(
        { frequency: "weekly", weekday: 3, monthday: null, hour: 9 },
        now,
        WIB,
      )!.toISOString(),
    ).toBe("2026-06-17T02:00:00.000Z");
    // Senin (1) jam 8 sudah... 07:00 WIB < 08:00 → hari ini
    expect(
      computeNextRun(
        { frequency: "weekly", weekday: 1, monthday: null, hour: 8 },
        now,
        WIB,
      )!.toISOString(),
    ).toBe("2026-06-15T01:00:00.000Z");
    expect(
      computeNextRun(
        { frequency: "monthly", weekday: null, monthday: 1, hour: 8 },
        now,
        WIB,
      )!.toISOString(),
    ).toBe("2026-07-01T01:00:00.000Z");
    expect(
      computeNextRun({ frequency: "none", weekday: null, monthday: null, hour: 8 }, now, WIB),
    ).toBeNull();
  });
  it("selalu di masa depan, tidak pernah sama dengan now", () => {
    const at = computeNextRun(
      { frequency: "daily", weekday: null, monthday: null, hour: 7 },
      now,
      WIB,
    )!;
    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });
});
