import { describe, expect, it } from "vitest";
import { dealRisk } from "@/modules/deals/risk";

const now = new Date("2026-11-11T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString().slice(0, 10);

describe("dealRisk", () => {
  it("tinggi bila melewati closing atau mandek mendekati closing", () => {
    expect(dealRisk({ status: "open", expectedCloseDate: inDays(-3) }, ago(0), now)?.level).toBe(
      "high",
    );
    expect(dealRisk({ status: "open", expectedCloseDate: inDays(5) }, ago(8), now)?.level).toBe(
      "high",
    );
  });
  it("sedang bila closing dalam sebulan dan lama tak tersentuh", () => {
    expect(dealRisk({ status: "open", expectedCloseDate: inDays(25) }, ago(15), now)?.level).toBe(
      "medium",
    );
    expect(dealRisk({ status: "open", expectedCloseDate: null }, ago(31), now)?.level).toBe(
      "medium",
    );
  });
  it("tidak ada risiko untuk deal sehat atau sudah ditutup", () => {
    expect(dealRisk({ status: "open", expectedCloseDate: inDays(5) }, ago(1), now)).toBeNull();
    expect(dealRisk({ status: "won", expectedCloseDate: inDays(-30) }, ago(60), now)).toBeNull();
  });
});
