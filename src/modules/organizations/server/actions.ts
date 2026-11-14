"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { tenantAction, type ActionResult } from "@/lib/action";
import { assertCan } from "@/lib/authz";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { forTenant } from "@/lib/tenant";
import { DEMO_BUSINESSES } from "@/modules/organizations/demo-businesses";
import { DEMO_PROFILES } from "@/modules/organizations/server/demo-profiles";
import { createDemoWorkspace } from "@/modules/organizations/server/demo-workspace";
import { seedOrganizationDefaults } from "@/modules/organizations/server/defaults";
import { getSession } from "@/lib/session";
import {
  changeRoleSchema,
  idSchema,
  inviteMemberSchema,
  onboardingSchema,
  organizationProfileSchema,
  renameTeamSchema,
  setActiveSchema,
  slugify,
  teamMembersSchema,
  teamSchema,
} from "@/modules/organizations/schemas";

// ---------------------------------------------------------------------------
// Onboarding: pengguna tanpa organisasi (atau menambah organisasi baru) — hanya butuh session.
// ---------------------------------------------------------------------------
export async function createOrganizationAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession();
    if (!session) throw UnauthorizedError();
    const input = onboardingSchema.safeParse(raw);
    if (!input.success)
      return { ok: false, error: input.error.issues[0]?.message ?? "Input tidak valid" };

    const h = await headers();
    const org = await auth.api.createOrganization({
      headers: h,
      body: {
        name: input.data.name,
        slug: slugify(input.data.name),
        keepCurrentActiveOrganization: false,
      },
    });
    if (!org) throw new AppError("Gagal membuat organisasi");
    await prisma.organization.update({
      where: { id: org.id },
      data: { timezone: input.data.timezone, defaultCurrency: input.data.defaultCurrency },
    });
    await seedOrganizationDefaults(org.id);
    await writeAudit(
      { db: forTenant(prisma, org.id), userId: session.user.id, ip: h.get("x-forwarded-for") },
      {
        action: "organization.created",
        entityType: "Organization",
        entityId: org.id,
        after: input.data,
      },
    );
    return { ok: true, data: { id: org.id } };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    return { ok: false, error: "Gagal membuat organisasi" };
  }
}

// ---------------------------------------------------------------------------
// Profil organisasi (SET-01)
// ---------------------------------------------------------------------------
export const updateOrganizationProfile = tenantAction(
  organizationProfileSchema,
  async (ctx, input) => {
    assertCan(ctx, "update", "Organization");
    const before = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { name: true, timezone: true, defaultCurrency: true, dateFormat: true },
    });
    await prisma.organization.update({ where: { id: ctx.organizationId }, data: input });
    await writeAudit(ctx, {
      action: "organization.updated",
      entityType: "Organization",
      entityId: ctx.organizationId,
      before,
      after: input,
    });
    revalidatePath("/settings");
  },
);

// ---------------------------------------------------------------------------
// Anggota & undangan (SET-02)
// ---------------------------------------------------------------------------
export const inviteMember = tenantAction(inviteMemberSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Member");
  if (input.role === "owner" && ctx.role !== "owner") throw ForbiddenError();
  const existing = await ctx.db.member.findFirst({
    where: { user: { email: input.email } },
    select: { active: true },
  });
  if (existing?.active) throw new AppError("Pengguna ini sudah menjadi anggota");
  const inv = await auth.api
    .createInvitation({
      headers: await headers(),
      body: { email: input.email, role: input.role, organizationId: ctx.organizationId },
    })
    .catch(() => {
      throw new AppError("Gagal membuat undangan");
    });
  await writeAudit(ctx, {
    action: "invitation.created",
    entityType: "Invitation",
    entityId: inv?.id,
    after: { email: input.email, role: input.role },
  });
  revalidatePath("/users");
});

export const revokeInvitation = tenantAction(idSchema, async (ctx, { id }) => {
  assertCan(ctx, "create", "Member");
  const inv = await ctx.db.invitation.findFirst({ where: { id }, select: { email: true } });
  if (!inv) throw new AppError("Undangan tidak ditemukan", 404, "not_found");
  await ctx.db.invitation.update({ where: { id }, data: { status: "canceled" } });
  await writeAudit(ctx, {
    action: "invitation.revoked",
    entityType: "Invitation",
    entityId: id,
    before: { email: inv.email },
  });
  revalidatePath("/users");
});

async function loadTarget(
  ctx: Parameters<typeof assertCan>[0] & { db: ReturnType<typeof forTenant> },
  memberId: string,
) {
  const target = await ctx.db.member.findFirst({ where: { id: memberId } });
  if (!target) throw new AppError("Anggota tidak ditemukan", 404, "not_found");
  return target;
}

async function activeOwnerCount(ctx: { db: ReturnType<typeof forTenant> }) {
  return ctx.db.member.count({ where: { role: "owner", active: true } });
}

export const changeMemberRole = tenantAction(changeRoleSchema, async (ctx, { memberId, role }) => {
  assertCan(ctx, "update", "Member");
  const target = await loadTarget(ctx, memberId);
  if (target.userId === ctx.userId) throw new AppError("Anda tidak dapat mengubah role sendiri");
  // Hanya Owner yang boleh memberi/mencabut role Owner.
  if ((role === "owner" || target.role === "owner") && ctx.role !== "owner") throw ForbiddenError();
  if (target.role === "owner" && role !== "owner" && (await activeOwnerCount(ctx)) <= 1) {
    throw new AppError("Organisasi harus memiliki minimal satu Owner aktif");
  }
  await ctx.db.member.update({ where: { id: memberId }, data: { role } });
  await writeAudit(ctx, {
    action: "member.role_changed",
    entityType: "Member",
    entityId: memberId,
    before: { role: target.role },
    after: { role },
  });
  revalidatePath("/users");
});

export const setMemberActive = tenantAction(setActiveSchema, async (ctx, { memberId, active }) => {
  assertCan(ctx, "update", "Member");
  const target = await loadTarget(ctx, memberId);
  if (target.userId === ctx.userId)
    throw new AppError("Anda tidak dapat menonaktifkan diri sendiri");
  if (target.role === "owner" && ctx.role !== "owner") throw ForbiddenError();
  if (!active && target.role === "owner" && (await activeOwnerCount(ctx)) <= 1) {
    throw new AppError("Organisasi harus memiliki minimal satu Owner aktif");
  }
  await ctx.db.member.update({
    where: { id: memberId },
    data: { active, deactivatedAt: active ? null : new Date() },
  });
  await writeAudit(ctx, {
    action: active ? "member.reactivated" : "member.deactivated",
    entityType: "Member",
    entityId: memberId,
    before: { active: target.active },
    after: { active },
  });
  revalidatePath("/users");
});

// ---------------------------------------------------------------------------
// Tim (SET-04)
// ---------------------------------------------------------------------------
export const createTeam = tenantAction(teamSchema, async (ctx, { name }) => {
  assertCan(ctx, "create", "Team");
  const dup = await ctx.db.team.findFirst({ where: { name } });
  if (dup) throw new AppError("Nama tim sudah dipakai");
  const team = await ctx.db.team.create({ data: { name, createdBy: ctx.userId } as never });
  await writeAudit(ctx, {
    action: "team.created",
    entityType: "Team",
    entityId: team.id,
    after: { name },
  });
  revalidatePath("/users");
  return { id: team.id };
});

export const renameTeam = tenantAction(renameTeamSchema, async (ctx, { id, name }) => {
  assertCan(ctx, "update", "Team");
  const team = await ctx.db.team.findFirst({ where: { id } });
  if (!team) throw new AppError("Tim tidak ditemukan", 404, "not_found");
  await ctx.db.team.update({ where: { id }, data: { name, updatedBy: ctx.userId } });
  await writeAudit(ctx, {
    action: "team.renamed",
    entityType: "Team",
    entityId: id,
    before: { name: team.name },
    after: { name },
  });
  revalidatePath("/users");
});

export const deleteTeam = tenantAction(idSchema, async (ctx, { id }) => {
  assertCan(ctx, "delete", "Team");
  const team = await ctx.db.team.findFirst({ where: { id } });
  if (!team) throw new AppError("Tim tidak ditemukan", 404, "not_found");
  await ctx.db.team.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "team.deleted",
    entityType: "Team",
    entityId: id,
    before: { name: team.name },
  });
  revalidatePath("/users");
});

/** Ganti seluruh anggota tim; hanya anggota aktif organisasi yang diterima. */
export const setTeamMembers = tenantAction(teamMembersSchema, async (ctx, { teamId, userIds }) => {
  assertCan(ctx, "update", "Team");
  const team = await ctx.db.team.findFirst({ where: { id: teamId } });
  if (!team) throw new AppError("Tim tidak ditemukan", 404, "not_found");
  const wanted = Array.from(new Set(userIds));
  const valid = await ctx.db.member.findMany({
    where: { userId: { in: wanted }, active: true },
    select: { userId: true },
  });
  if (valid.length !== wanted.length)
    throw new AppError("Ada pengguna yang bukan anggota aktif organisasi");
  const before = await ctx.db.teamMember.findMany({ where: { teamId }, select: { userId: true } });
  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { teamId, organizationId: ctx.organizationId } }),
    prisma.teamMember.createMany({
      data: wanted.map((userId) => ({ teamId, userId, organizationId: ctx.organizationId })),
    }),
  ]);
  await writeAudit(ctx, {
    action: "team.members_changed",
    entityType: "Team",
    entityId: teamId,
    before: { userIds: before.map((b) => b.userId) },
    after: { userIds: wanted },
  });
  revalidatePath("/users");
});

// ---------------------------------------------------------------------------
// Workspace demo (tombol "Load Demo Workspace" di Settings) — hanya Owner.
// ---------------------------------------------------------------------------
/**
 * Membuat organisasi BARU berisi data demo lengkap dengan pengguna ini sebagai Owner.
 * Tidak mengubah/menghapus data organisasi yang sedang aktif. Pengguna demo memakai domain
 * `*.example` (tidak menerima email) dan tidak punya akun login. Atomik: gagal = tidak ada sisa data.
 */
export const loadDemoWorkspace = tenantAction(
  z.object({ business: z.enum(DEMO_BUSINESSES) }),
  async (ctx, { business }) => {
    if (ctx.role !== "owner") throw ForbiddenError();
    const rl = await rateLimit(`demo-workspace:${ctx.userId}`, 3, 60 * 60);
    if (!rl.allowed) {
      throw new AppError("Workspace demo sudah dibuat beberapa kali. Coba lagi dalam 1 jam.", 429);
    }
    const suffix = randomBytes(3).toString("hex");
    const profile = DEMO_PROFILES[business];
    const orgName = `Demo · ${profile.orgName}`;
    const { orgId } = await prisma.$transaction(
      (tx) =>
        createDemoWorkspace(tx, {
          ownerUserId: ctx.userId,
          orgName,
          orgSlug: `demo-${business}-${suffix}`,
          emailDomain: `demo-${suffix}.example`,
          business,
        }),
      { timeout: 180_000, maxWait: 20_000 },
    );
    await writeAudit(ctx, {
      action: "organization.demo_created",
      entityType: "Organization",
      entityId: orgId,
      after: { name: orgName, business },
    });
    return { organizationId: orgId, name: orgName };
  },
);

// ---------------------------------------------------------------------------
// Hapus workspace — hanya Owner, dengan konfirmasi nama workspace.
// ---------------------------------------------------------------------------
/**
 * Soft delete organisasi aktif (`deletedAt`): langsung tidak dapat diakses semua anggota, webhook &
 * job latar belakang berhenti, undangan pending dibatalkan. Data tetap di database (dapat dipulihkan
 * admin server). Mengembalikan workspace lain milik pengguna untuk dialihkan, atau null → onboarding.
 */
export const deleteWorkspace = tenantAction(
  z.object({ confirmName: z.string().trim().min(1).max(200) }),
  async (ctx, { confirmName }) => {
    if (ctx.role !== "owner") throw ForbiddenError();
    const org = await prisma.organization.findFirst({
      where: { id: ctx.organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!org) throw new AppError("Workspace tidak ditemukan", 404, "not_found");
    if (confirmName !== org.name.trim()) {
      throw new AppError("Nama workspace tidak cocok. Ketik nama persis untuk konfirmasi.");
    }
    await prisma.$transaction([
      prisma.organization.update({ where: { id: org.id }, data: { deletedAt: new Date() } }),
      prisma.invitation.updateMany({
        where: { organizationId: org.id, status: "pending" },
        data: { status: "canceled" },
      }),
    ]);
    await writeAudit(ctx, {
      action: "organization.deleted",
      entityType: "Organization",
      entityId: org.id,
      before: { name: org.name },
    });
    const next = await prisma.member.findFirst({
      where: { userId: ctx.userId, active: true, organization: { deletedAt: null } },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });
    return { nextOrganizationId: next?.organizationId ?? null };
  },
);
