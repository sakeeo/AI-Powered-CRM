import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, createUser, headersFor } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { mails } from "../helpers/mails";

const { auth } = await import("@/lib/auth");
const { getTenantContext } = await import("@/lib/context");
const { redis } = await import("@/lib/redis");
const actions = await import("@/modules/organizations/server/actions");
const queries = await import("@/modules/organizations/server/queries");

const profile = {
  name: "Acme",
  timezone: "Asia/Jakarta",
  defaultCurrency: "IDR",
  dateFormat: "dd/MM/yyyy",
} as const;

async function setupOrg() {
  const owner = await createUser("Owner");
  actAs(owner);
  const res = await actions.createOrganizationAction(profile);
  if (!res.ok) throw new Error(res.error);
  return { owner, orgId: res.data.id };
}

/** Undang + terima sebagai user baru dengan role tertentu. */
async function addMember(
  owner: { cookie: string },
  orgId: string,
  role: "admin" | "sales_manager" | "sales_rep" | "viewer",
  name: string,
) {
  const user = await createUser(name);
  actAs(owner);
  mails.length = 0;
  const inv = await actions.inviteMember({ email: user.email, role });
  if (!inv.ok) throw new Error(inv.error);
  const id = mails.at(-1)!.text.match(/accept-invitation\/([\w-]+)/)![1];
  await auth.api.acceptInvitation({ headers: headersFor(user), body: { invitationId: id } });
  await auth.api.setActiveOrganization({
    headers: headersFor(user),
    body: { organizationId: orgId },
  });
  return user;
}

beforeEach(async () => {
  await resetDb();
  mails.length = 0;
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("onboarding & profil organisasi", () => {
  it("pembuat menjadi Owner, profil tersimpan, audit tercatat", async () => {
    const { owner, orgId } = await setupOrg();
    const member = await testPrisma.member.findFirstOrThrow({ where: { userId: owner.id } });
    expect(member.role).toBe("owner");
    const org = await testPrisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.timezone).toBe("Asia/Jakarta");
    expect(
      await testPrisma.auditLog.count({
        where: { organizationId: orgId, action: "organization.created" },
      }),
    ).toBe(1);
  });

  it("Owner mengubah profil; role lain tanpa izin ditolak", async () => {
    const { owner, orgId } = await setupOrg();
    const rep = await addMember(owner, orgId, "sales_rep", "Rep");

    actAs(owner);
    expect(
      (
        await actions.updateOrganizationProfile({
          ...profile,
          name: "Acme 2",
          timezone: "Asia/Makassar",
        })
      ).ok,
    ).toBe(true);
    expect(
      (await testPrisma.organization.findUniqueOrThrow({ where: { id: orgId } })).timezone,
    ).toBe("Asia/Makassar");

    actAs(rep);
    const denied = await actions.updateOrganizationProfile({ ...profile, name: "Hacked" });
    expect(denied).toEqual({ ok: false, error: "Akses ditolak" });
  });

  it("zona waktu tidak valid ditolak", async () => {
    const { owner } = await setupOrg();
    actAs(owner);
    const res = await actions.updateOrganizationProfile({ ...profile, timezone: "Mars/Olympus" });
    expect(res.ok).toBe(false);
  });
});

describe("undangan & anggota", () => {
  it("undang → email terkirim → terima → menjadi anggota dengan role", async () => {
    const { owner, orgId } = await setupOrg();
    const user = await createUser("Budi");
    actAs(owner);
    const res = await actions.inviteMember({ email: user.email, role: "sales_rep" });
    expect(res.ok).toBe(true);
    expect(mails.at(-1)?.to).toBe(user.email);
    expect((await queries.listPendingInvitations((await getTenantContext())!)).length).toBe(1);

    const id = mails.at(-1)!.text.match(/accept-invitation\/([\w-]+)/)![1];
    await auth.api.acceptInvitation({ headers: headersFor(user), body: { invitationId: id } });
    const member = await testPrisma.member.findFirstOrThrow({
      where: { userId: user.id, organizationId: orgId },
    });
    expect(member.role).toBe("sales_rep");
    expect(member.active).toBe(true);
  });

  it("undangan hanya bisa diterima oleh email yang diundang", async () => {
    const { owner } = await setupOrg();
    const invited = await createUser("Invited");
    const other = await createUser("Other");
    actAs(owner);
    await actions.inviteMember({ email: invited.email, role: "viewer" });
    const id = mails.at(-1)!.text.match(/accept-invitation\/([\w-]+)/)![1];
    await expect(
      auth.api.acceptInvitation({ headers: headersFor(other), body: { invitationId: id } }),
    ).rejects.toBeTruthy();
    expect(await testPrisma.member.count({ where: { userId: other.id } })).toBe(0);
  });

  it("revoke membatalkan undangan", async () => {
    const { owner } = await setupOrg();
    actAs(owner);
    await actions.inviteMember({ email: "x@example.com", role: "viewer" });
    const ctx = (await getTenantContext())!;
    const [inv] = await queries.listPendingInvitations(ctx);
    expect((await actions.revokeInvitation({ id: inv.id })).ok).toBe(true);
    expect(await queries.listPendingInvitations(ctx)).toHaveLength(0);
  });

  it("Owner mengubah role; non-admin tidak boleh; tidak bisa ubah role sendiri", async () => {
    const { owner, orgId } = await setupOrg();
    const rep = await addMember(owner, orgId, "sales_rep", "Rep");
    const viewer = await addMember(owner, orgId, "viewer", "Viewer");
    const repMember = await testPrisma.member.findFirstOrThrow({ where: { userId: rep.id } });

    actAs(owner);
    expect(
      (await actions.changeMemberRole({ memberId: repMember.id, role: "sales_manager" })).ok,
    ).toBe(true);
    expect((await testPrisma.member.findUniqueOrThrow({ where: { id: repMember.id } })).role).toBe(
      "sales_manager",
    );

    actAs(viewer);
    expect(await actions.changeMemberRole({ memberId: repMember.id, role: "viewer" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });

    actAs(owner);
    const ownerMember = await testPrisma.member.findFirstOrThrow({ where: { userId: owner.id } });
    const self = await actions.changeMemberRole({ memberId: ownerMember.id, role: "admin" });
    expect(self.ok).toBe(false);
    expect(await testPrisma.auditLog.count({ where: { action: "member.role_changed" } })).toBe(1);
  });

  it("Admin tidak boleh mengangkat Owner atau mengubah Owner", async () => {
    const { owner, orgId } = await setupOrg();
    const admin = await addMember(owner, orgId, "admin", "Admin");
    const rep = await addMember(owner, orgId, "sales_rep", "Rep");
    const repMember = await testPrisma.member.findFirstOrThrow({ where: { userId: rep.id } });
    const ownerMember = await testPrisma.member.findFirstOrThrow({ where: { userId: owner.id } });
    actAs(admin);
    expect((await actions.changeMemberRole({ memberId: repMember.id, role: "owner" })).ok).toBe(
      false,
    );
    expect((await actions.changeMemberRole({ memberId: ownerMember.id, role: "viewer" })).ok).toBe(
      false,
    );
    expect((await actions.setMemberActive({ memberId: ownerMember.id, active: false })).ok).toBe(
      false,
    );
    expect((await actions.inviteMember({ email: "o@example.com", role: "owner" })).ok).toBe(false);
  });

  it("organisasi tidak boleh kehilangan Owner aktif terakhir", async () => {
    const { owner, orgId } = await setupOrg();
    const admin = await addMember(owner, orgId, "admin", "Admin");
    const ownerMember = await testPrisma.member.findFirstOrThrow({ where: { userId: owner.id } });
    // promosikan admin menjadi owner kedua, lalu owner pertama turun → boleh; owner terakhir tidak boleh
    const adminMember = await testPrisma.member.findFirstOrThrow({ where: { userId: admin.id } });
    actAs(owner);
    expect((await actions.changeMemberRole({ memberId: adminMember.id, role: "owner" })).ok).toBe(
      true,
    );
    actAs(admin);
    expect((await actions.changeMemberRole({ memberId: ownerMember.id, role: "viewer" })).ok).toBe(
      true,
    );
    actAs(owner);
    // owner (kini viewer) tak lagi punya izin
    expect((await actions.setMemberActive({ memberId: adminMember.id, active: false })).ok).toBe(
      false,
    );
  });

  it("anggota nonaktif kehilangan akses organisasi", async () => {
    const { owner, orgId } = await setupOrg();
    const rep = await addMember(owner, orgId, "sales_rep", "Rep");
    const repMember = await testPrisma.member.findFirstOrThrow({ where: { userId: rep.id } });
    actAs(rep);
    expect((await getTenantContext())?.organizationId).toBe(orgId);

    actAs(owner);
    expect((await actions.setMemberActive({ memberId: repMember.id, active: false })).ok).toBe(
      true,
    );
    actAs(rep);
    expect(await getTenantContext()).toBeNull();

    actAs(owner);
    await actions.setMemberActive({ memberId: repMember.id, active: true });
    actAs(rep);
    expect((await getTenantContext())?.organizationId).toBe(orgId);
  });
});

describe("multi-organisasi", () => {
  it("pengguna hanya melihat organisasinya; pergantian organisasi mengubah tenant context", async () => {
    const a = await setupOrg();
    const b = await setupOrg();
    const stranger = await createUser("Stranger");

    actAs(stranger);
    expect(await queries.listMyOrganizations(stranger.id)).toEqual([]);

    // owner A diundang ke organisasi B sebagai viewer
    actAs(b.owner);
    await actions.inviteMember({ email: a.owner.email, role: "viewer" });
    const id = mails.at(-1)!.text.match(/accept-invitation\/([\w-]+)/)![1];
    await auth.api.acceptInvitation({ headers: headersFor(a.owner), body: { invitationId: id } });

    actAs(a.owner);
    const orgs = await queries.listMyOrganizations(a.owner.id);
    expect(orgs.map((o) => o.id).sort()).toEqual([a.orgId, b.orgId].sort());

    await auth.api.setActiveOrganization({
      headers: headersFor(a.owner),
      body: { organizationId: b.orgId },
    });
    const ctx = await getTenantContext();
    expect(ctx?.organizationId).toBe(b.orgId);
    expect(ctx?.role).toBe("viewer");

    await auth.api.setActiveOrganization({
      headers: headersFor(a.owner),
      body: { organizationId: a.orgId },
    });
    expect((await getTenantContext())?.role).toBe("owner");
  });

  it("organisasi aktif yang bukan miliknya diabaikan (tenant dari membership, bukan input)", async () => {
    const a = await setupOrg();
    const b = await setupOrg();
    // paksa session A menunjuk org B
    await testPrisma.session.updateMany({
      where: { userId: a.owner.id },
      data: { activeOrganizationId: b.orgId },
    });
    actAs(a.owner);
    expect((await getTenantContext())?.organizationId).toBe(a.orgId);
  });
});

describe("tim", () => {
  it("membuat tim, mengisi anggota, menolak non-anggota, audit tercatat", async () => {
    const { owner, orgId } = await setupOrg();
    const rep = await addMember(owner, orgId, "sales_rep", "Rep");
    const outsider = await createUser("Outsider");
    actAs(owner);
    const created = await actions.createTeam({ name: "Sales A" });
    expect(created.ok).toBe(true);
    const teamId = (created as { ok: true; data: { id: string } }).data.id;
    expect((await actions.createTeam({ name: "Sales A" })).ok).toBe(false); // duplikat

    expect((await actions.setTeamMembers({ teamId, userIds: [owner.id, rep.id] })).ok).toBe(true);
    expect(await testPrisma.teamMember.count({ where: { teamId } })).toBe(2);
    expect((await actions.setTeamMembers({ teamId, userIds: [outsider.id] })).ok).toBe(false);
    expect(await testPrisma.teamMember.count({ where: { teamId } })).toBe(2);

    expect((await queries.listTeams((await getTenantContext())!))[0].userIds.sort()).toEqual(
      [owner.id, rep.id].sort(),
    );
    expect(
      await testPrisma.auditLog.count({ where: { entityType: "Team" } }),
    ).toBeGreaterThanOrEqual(2);

    actAs(rep);
    expect(await actions.createTeam({ name: "Hack" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
  });
});

describe("hapus workspace", () => {
  it("hanya Owner, wajib nama cocok; soft delete membatalkan undangan & menutup akses", async () => {
    const { owner, orgId } = await setupOrg();
    const admin = await addMember(owner, orgId, "admin", "Admin");
    actAs(owner);
    await actions.inviteMember({ email: "calon@example.com", role: "sales_rep" });

    // Bukan Owner → ditolak.
    actAs(admin);
    expect(await actions.deleteWorkspace({ confirmName: "Acme" })).toMatchObject({ ok: false });

    // Nama tidak cocok → ditolak, workspace utuh.
    actAs(owner);
    expect(await actions.deleteWorkspace({ confirmName: "acme" })).toMatchObject({ ok: false });
    expect(
      (await testPrisma.organization.findUniqueOrThrow({ where: { id: orgId } })).deletedAt,
    ).toBeNull();

    // Owner + nama cocok → dihapus (soft delete).
    const res = await actions.deleteWorkspace({ confirmName: "Acme" });
    expect(res).toMatchObject({ ok: true, data: { nextOrganizationId: null } });
    const org = await testPrisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.deletedAt).not.toBeNull();
    expect(
      await testPrisma.invitation.count({ where: { organizationId: orgId, status: "pending" } }),
    ).toBe(0);
    expect(
      await testPrisma.auditLog.count({
        where: { organizationId: orgId, action: "organization.deleted" },
      }),
    ).toBe(1);

    // Workspace tidak lagi muncul / dapat diakses oleh anggota mana pun.
    expect(await queries.listMyOrganizations(owner.id)).toHaveLength(0);
    actAs(admin);
    expect(await getTenantContext()).toBeNull();
  });

  it("mengembalikan workspace lain milik pengguna untuk dialihkan", async () => {
    const { owner } = await setupOrg();
    const second = await actions.createOrganizationAction({ ...profile, name: "Beta" });
    if (!second.ok) throw new Error(second.error);
    // Workspace aktif = Beta (baru dibuat); hapus Beta → dialihkan ke Acme.
    actAs(owner);
    const res = await actions.deleteWorkspace({ confirmName: "Beta" });
    expect(res.ok && res.data.nextOrganizationId).toBeTruthy();
    expect(await queries.listMyOrganizations(owner.id)).toHaveLength(1);
  });
});
