import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, createUser } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { prisma } = await import("@/lib/prisma");
const { forTenant, TENANT_MODELS, TenantScopeError } = await import("@/lib/tenant");
const { getTenantContext } = await import("@/lib/context");
const actions = await import("@/modules/organizations/server/actions");
const queries = await import("@/modules/organizations/server/queries");
const { listAuditLogs } = await import("@/modules/audit/server/queries");

const profile = {
  name: "Org",
  timezone: "Asia/Jakarta",
  defaultCurrency: "IDR",
  dateFormat: "dd/MM/yyyy",
} as const;

async function makeTenant(name: string) {
  const owner = await createUser(name);
  actAs(owner);
  const res = await actions.createOrganizationAction({ ...profile, name });
  if (!res.ok) throw new Error(res.error);
  const team = await actions.createTeam({ name: `${name} team` });
  if (!team.ok) throw new Error(team.error);
  return { owner, orgId: res.data.id, teamId: team.data.id };
}

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("isolasi tenant (IDOR) — entitas organisasi", () => {
  it("tenant A tidak bisa membaca, mengubah, atau menghapus data tenant B", async () => {
    const a = await makeTenant("Org A");
    const b = await makeTenant("Org B");
    const bMember = await testPrisma.member.findFirstOrThrow({
      where: { organizationId: b.orgId },
    });

    actAs(a.owner);
    // baca: daftar hanya milik A
    const ctx = (await getTenantContext())!;
    expect((await queries.listMembers(ctx)).every((m) => m.userId === a.owner.id)).toBe(true);
    expect((await queries.listTeams(ctx)).map((t) => t.id)).toEqual([a.teamId]);

    // ubah/hapus lewat id milik B → "tidak ditemukan", data B utuh
    expect(await actions.changeMemberRole({ memberId: bMember.id, role: "viewer" })).toMatchObject({
      ok: false,
    });
    expect(await actions.setMemberActive({ memberId: bMember.id, active: false })).toMatchObject({
      ok: false,
    });
    expect(await actions.renameTeam({ id: b.teamId, name: "Hijacked" })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteTeam({ id: b.teamId })).toMatchObject({ ok: false });
    expect(await actions.setTeamMembers({ teamId: b.teamId, userIds: [a.owner.id] })).toMatchObject(
      { ok: false },
    );
    expect(await actions.revokeInvitation({ id: b.orgId })).toMatchObject({ ok: false });

    expect((await testPrisma.member.findUniqueOrThrow({ where: { id: bMember.id } })).role).toBe(
      "owner",
    );
    expect((await testPrisma.team.findUniqueOrThrow({ where: { id: b.teamId } })).name).toBe(
      "Org B team",
    );
    expect(await testPrisma.teamMember.count({ where: { teamId: b.teamId } })).toBe(0);
  });

  it("audit log hanya menampilkan catatan organisasi sendiri", async () => {
    const a = await makeTenant("Org A");
    const b = await makeTenant("Org B");
    actAs(a.owner);
    const ctx = (await getTenantContext())!;
    const { rows } = await listAuditLogs(ctx, {});
    expect(rows.length).toBeGreaterThan(0);
    const bLogs = await testPrisma.auditLog.findMany({ where: { organizationId: b.orgId } });
    const ids = new Set(rows.map((r) => r.id));
    for (const l of bLogs) expect(ids.has(l.id)).toBe(false);
  });

  it("audit log hanya untuk Owner/Admin", async () => {
    const a = await makeTenant("Org A");
    const rep = await createUser("Rep");
    await testPrisma.member.create({
      data: { organizationId: a.orgId, userId: rep.id, role: "sales_rep" },
    });
    await testPrisma.session.updateMany({
      where: { userId: rep.id },
      data: { activeOrganizationId: a.orgId },
    });
    actAs(rep);
    const ctx = (await getTenantContext())!;
    expect(ctx.role).toBe("sales_rep");
    await expect(listAuditLogs(ctx, {})).rejects.toMatchObject({ status: 403 });
  });
});

describe("forTenant — semua model bertenant", () => {
  it("setiap model di TENANT_MODELS menolak tenant lain & menyisipkan organizationId", async () => {
    const a = await makeTenant("Org A");
    const b = await makeTenant("Org B");
    const dbA = forTenant(prisma, a.orgId);
    for (const model of TENANT_MODELS) {
      const key = model.charAt(0).toLowerCase() + model.slice(1);
      const delegate = (
        dbA as unknown as Record<
          string,
          {
            findMany: (a?: unknown) => Promise<{ organizationId: string }[]>;
            count: (a?: unknown) => Promise<number>;
          }
        >
      )[key];
      const rows = await delegate.findMany();
      expect(
        rows.every((r) => r.organizationId === a.orgId),
        model,
      ).toBe(true);
      // memaksa where organizationId tenant lain ditolak
      await expect(
        delegate.findMany({ where: { organizationId: b.orgId } }),
        model,
      ).rejects.toBeInstanceOf(TenantScopeError);
    }
  });
});
