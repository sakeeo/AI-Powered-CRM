import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/context";
import { AppError } from "@/lib/errors";

/** Organisasi tempat pengguna menjadi anggota aktif — hanya milik user itu sendiri. */
export async function listMyOrganizations(userId: string) {
  const rows = await prisma.member.findMany({
    where: { userId, active: true, organization: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true, logo: true, updatedAt: true } },
    },
  });
  return rows.map((r) => ({
    id: r.organization.id,
    name: r.organization.name,
    role: r.role,
    logoUrl: orgLogoUrl(r.organization),
  }));
}

/** URL logo organisasi aktif (diberi versi agar cache browser ikut berubah saat logo diganti). */
export const orgLogoUrl = (o: { logo: string | null; updatedAt: Date }) =>
  o.logo ? `/api/organization/logo?v=${o.updatedAt.getTime()}` : null;

export function getOrganization(ctx: TenantContext) {
  return prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      updatedAt: true,
      timezone: true,
      defaultCurrency: true,
      dateFormat: true,
    },
  });
}

export async function listMembers(ctx: TenantContext) {
  const rows = await ctx.db.member.findMany({
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    active: m.active,
    createdAt: m.createdAt,
    name: m.user.name,
    email: m.user.email,
  }));
}

export function listPendingInvitations(ctx: TenantContext) {
  return ctx.db.invitation.findMany({
    where: { status: "pending", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true },
  });
}

export async function listTeams(ctx: TenantContext) {
  const teams = await ctx.db.team.findMany({
    orderBy: { name: "asc" },
    include: { members: { select: { userId: true } } },
  });
  return teams.map((t) => ({ id: t.id, name: t.name, userIds: t.members.map((m) => m.userId) }));
}

/** Anggota aktif organisasi untuk dropdown pemilik/assignee. */
export async function listOwnerOptions(ctx: TenantContext) {
  const rows = await ctx.db.member.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });
  return rows.map((m) => ({ userId: m.userId, name: m.user.name }));
}

/** Pastikan `userId` adalah anggota aktif organisasi (cegah menugaskan ke user tenant lain). */
export async function assertActiveMember(ctx: TenantContext, userId: string) {
  const ok = await ctx.db.member.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  if (!ok) throw new AppError("Pemilik harus anggota aktif organisasi");
}
