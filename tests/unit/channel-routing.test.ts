import { describe, expect, it } from "vitest";
import { chooseAssignee } from "@/modules/omnichannel/routing";
import {
  isAutoLoggedMessageActivity,
  mergeTimeline,
  stripHtml,
} from "@/modules/omnichannel/timeline";

const eligible = ["u3", "u1", "u2"];

describe("chooseAssignee", () => {
  it("none → tidak ditugaskan", () => {
    expect(
      chooseAssignee({ strategy: "none", stickyOwnerId: "u1", pool: [], cursor: 0, eligible }),
    ).toMatchObject({ assigneeId: null, usedCursor: false });
  });
  it("round robin bergilir urut stabil dan memakai kursor", () => {
    const pick = (cursor: number) =>
      chooseAssignee({ strategy: "round_robin", stickyOwnerId: null, pool: [], cursor, eligible });
    expect([0, 1, 2, 3, 4].map((c) => pick(c).assigneeId)).toEqual(["u1", "u2", "u3", "u1", "u2"]);
    expect(pick(0).usedCursor).toBe(true);
  });
  it("pool dibatasi pada anggota layak; anggota tak layak/tidak aktif diabaikan", () => {
    const r = chooseAssignee({
      strategy: "round_robin",
      stickyOwnerId: null,
      pool: ["u2", "ghost"],
      cursor: 5,
      eligible,
    });
    expect(r.assigneeId).toBe("u2");
    expect(
      chooseAssignee({
        strategy: "round_robin",
        stickyOwnerId: null,
        pool: ["ghost"],
        cursor: 0,
        eligible,
      }),
    ).toMatchObject({ assigneeId: null, reason: "no_eligible" });
  });
  it("sticky_owner: pemilik layak dipakai (tanpa menaikkan kursor); jika tidak → round robin", () => {
    expect(
      chooseAssignee({
        strategy: "sticky_owner",
        stickyOwnerId: "u2",
        pool: [],
        cursor: 0,
        eligible,
      }),
    ).toMatchObject({ assigneeId: "u2", usedCursor: false, reason: "sticky_owner" });
    expect(
      chooseAssignee({
        strategy: "sticky_owner",
        stickyOwnerId: "nonaktif",
        pool: [],
        cursor: 1,
        eligible,
      }),
    ).toMatchObject({ assigneeId: "u2", usedCursor: true });
    expect(
      chooseAssignee({
        strategy: "sticky_owner",
        stickyOwnerId: null,
        pool: [],
        cursor: 0,
        eligible: [],
      }).assigneeId,
    ).toBeNull();
  });
});

describe("timeline helpers", () => {
  it("stripHtml, deteksi aktivitas auto-log WhatsApp, dan urutan terbaru dulu", () => {
    expect(stripHtml("<p>Halo &amp; <b>dunia</b></p><p>baris 2</p>")).toBe("Halo & dunia\nbaris 2");
    expect(isAutoLoggedMessageActivity({ type: "whatsapp", subject: "WhatsApp masuk: hai" })).toBe(
      true,
    );
    expect(isAutoLoggedMessageActivity({ type: "whatsapp", subject: "Catatan chat manual" })).toBe(
      false,
    );
    expect(isAutoLoggedMessageActivity({ type: "call", subject: "WhatsApp masuk: x" })).toBe(false);
    const mk = (id: string, at: string) => ({
      id,
      at: new Date(at),
      source: "message" as const,
      channel: "email",
      direction: null,
      title: "",
      text: "",
      href: null,
    });
    expect(
      mergeTimeline([mk("a", "2026-01-01"), mk("b", "2026-03-01"), mk("c", "2026-02-01")], 2).map(
        (i) => i.id,
      ),
    ).toEqual(["b", "c"]);
  });
});
