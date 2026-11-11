import { describe, expect, it } from "vitest";
import { applyTenantScope, TenantScopeError } from "@/lib/tenant";

const ORG = "org-a";

describe("applyTenantScope", () => {
  it("menyisipkan organizationId pada create", () => {
    expect(applyTenantScope("create", { data: { name: "x" } }, ORG)).toEqual({
      data: { name: "x", organizationId: ORG },
    });
  });

  it("menyisipkan organizationId pada setiap baris createMany", () => {
    const out = applyTenantScope("createMany", { data: [{ n: 1 }, { n: 2 }] }, ORG) as {
      data: { organizationId: string }[];
    };
    expect(out.data.every((d) => d.organizationId === ORG)).toBe(true);
  });

  it.each(["findMany", "findFirst", "findUnique", "count", "updateMany", "deleteMany", "delete"])(
    "meng-AND organizationId pada where untuk %s",
    (op) => {
      expect(applyTenantScope(op, { where: { id: "1" } }, ORG)).toEqual({
        where: { id: "1", organizationId: ORG },
      });
    },
  );

  it("menambahkan where bila args kosong", () => {
    expect(applyTenantScope("findMany", undefined, ORG)).toEqual({
      where: { organizationId: ORG },
    });
  });

  it("scope where dan create pada upsert", () => {
    const out = applyTenantScope(
      "upsert",
      { where: { id: "1" }, create: { n: 1 }, update: { n: 2 } },
      ORG,
    ) as { where: object; create: object };
    expect(out.where).toEqual({ id: "1", organizationId: ORG });
    expect(out.create).toEqual({ n: 1, organizationId: ORG });
  });

  it("menolak organizationId tenant lain (create, where, update data)", () => {
    expect(() => applyTenantScope("create", { data: { organizationId: "org-b" } }, ORG)).toThrow(
      TenantScopeError,
    );
    expect(() => applyTenantScope("findMany", { where: { organizationId: "org-b" } }, ORG)).toThrow(
      TenantScopeError,
    );
    expect(() =>
      applyTenantScope("update", { where: { id: "1" }, data: { organizationId: "org-b" } }, ORG),
    ).toThrow(TenantScopeError);
  });

  it("menolak organizationId kosong", () => {
    expect(() => applyTenantScope("findMany", {}, "")).toThrow(TenantScopeError);
  });
});
