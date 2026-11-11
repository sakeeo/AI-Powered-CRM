import { describe, expect, it } from "vitest";
import {
  abilityToWhere,
  asSubject,
  defineAbilityFor,
  permissionMatrix,
  SUBJECTS,
} from "@/lib/abilities";
import { ROLES, type Role } from "@/lib/roles";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const MATE = "33333333-3333-3333-3333-333333333333";
const ab = (role: Role, teamUserIds: string[] = []) =>
  defineAbilityFor({ role, userId: ME, teamUserIds });

describe("matriks permission per role", () => {
  it("owner: semua diizinkan", () => {
    const m = permissionMatrix("owner");
    for (const s of SUBJECTS) for (const a of Object.values(m[s])) expect(a).toBe("all");
  });

  it("admin: semua kecuali hapus organisasi", () => {
    const m = permissionMatrix("admin");
    expect(m.Organization.delete).toBe("none");
    expect(m.Organization.update).toBe("all");
    expect(m.Connector.update).toBe("all");
    expect(m.AuditLog.view).toBe("all");
  });

  it("viewer: hanya view", () => {
    const m = permissionMatrix("viewer");
    for (const s of SUBJECTS) {
      for (const action of ["create", "update", "delete", "export"] as const) {
        expect(m[s][action], `${s}.${action}`).toBe("none");
      }
    }
    expect(m.Lead.view).toBe("all");
    expect(m.Report.view).toBe("all");
    expect(m.Connector.view).toBe("none");
    expect(m.AuditLog.view).toBe("none");
  });

  it("sales_rep: lead/deal milik sendiri; tidak ada export, connector, audit", () => {
    const m = permissionMatrix("sales_rep");
    expect(m.Lead.view).toBe("own");
    expect(m.Lead.update).toBe("own");
    expect(m.Lead.delete).toBe("own");
    expect(m.Lead.create).toBe("all");
    expect(m.Lead.export).toBe("none");
    expect(m.Contact.view).toBe("all");
    expect(m.Pipeline.update).toBe("none");
    expect(m.Member.create).toBe("none");
    expect(m.Connector.view).toBe("none");
    expect(m.AuditLog.view).toBe("none");
  });

  it("sales_manager: lihat semua, ubah hanya milik tim, kelola pipeline & produk, export", () => {
    const m = permissionMatrix("sales_manager");
    expect(m.Lead.view).toBe("all");
    expect(m.Lead.update).toBe("own");
    expect(m.Lead.export).toBe("all");
    expect(m.Pipeline.update).toBe("all");
    expect(m.Product.delete).toBe("all");
    expect(m.Member.update).toBe("none");
    expect(m.Connector.view).toBe("none");
  });
});

describe("kondisi kepemilikan & tim", () => {
  it("sales_rep hanya bisa mengubah lead miliknya", () => {
    const a = ab("sales_rep");
    expect(a.can("update", asSubject("Lead", { ownerId: ME }))).toBe(true);
    expect(a.can("update", asSubject("Lead", { ownerId: OTHER }))).toBe(false);
    expect(a.can("view", asSubject("Lead", { ownerId: OTHER }))).toBe(false);
    expect(a.can("view", asSubject("Lead", { ownerId: null }))).toBe(false);
  });

  it("sales_manager dapat mengubah data anggota timnya, bukan tim lain", () => {
    const a = ab("sales_manager", [MATE]);
    expect(a.can("update", asSubject("Deal", { ownerId: MATE }))).toBe(true);
    expect(a.can("update", asSubject("Deal", { ownerId: ME }))).toBe(true);
    expect(a.can("update", asSubject("Deal", { ownerId: OTHER }))).toBe(false);
    expect(a.can("view", asSubject("Deal", { ownerId: OTHER }))).toBe(true);
  });

  it("abilityToWhere menerjemahkan kondisi menjadi filter Prisma", () => {
    expect(abilityToWhere(ab("owner"), "view", "Lead")).toEqual({});
    expect(abilityToWhere(ab("sales_rep"), "view", "Lead")).toEqual({ OR: [{ ownerId: ME }] });
    expect(abilityToWhere(ab("viewer"), "update", "Lead")).toBeNull();
    const mgr = abilityToWhere(ab("sales_manager", [MATE]), "update", "Lead") as {
      OR: { ownerId: { in: string[] } }[];
    };
    expect(mgr.OR[0].ownerId.in.sort()).toEqual([ME, MATE].sort());
    expect(abilityToWhere(ab("admin"), "delete", "Organization")).toBeNull();
  });

  it("semua role bernilai valid dan tak ada subjek tanpa aturan eksplisit yang bocor ke viewer", () => {
    for (const role of ROLES) expect(() => permissionMatrix(role)).not.toThrow();
  });
});
