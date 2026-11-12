import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { defineAbilityFor, type AppAbility } from "@/lib/abilities";
import { isRole, type Role } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { forTenant } from "@/lib/tenant";

export type TenantContext = {
  userId: string;
  user: { id: string; name: string; email: string };
  organizationId: string;
  role: Role;
  /** Izin bisnis pengguna di organisasi ini (CASL). Dipakai server & UI. */
  ability: AppAbility;
  /** Prisma client yang otomatis tenant-scoped. */
  db: ReturnType<typeof forTenant>;
};

/**
 * Konteks tenant dari session + keanggotaan aktif di database — BUKAN dari input client.
 * Organisasi aktif diambil dari session; bila tidak valid (bukan anggota / dinonaktifkan)
 * jatuh ke keanggotaan aktif pertama. Null bila belum login atau tak punya organisasi.
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const session = await getSession();
  if (!session) return null;
  const userId = session.user.id;
  const wanted = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;

  let member = wanted
    ? await prisma.member.findFirst({
        where: { userId, organizationId: wanted, active: true, organization: { deletedAt: null } },
      })
    : null;
  member ??= await prisma.member.findFirst({
    where: { userId, active: true, organization: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
  });
  if (!member || !isRole(member.role)) return null;

  return buildContext(
    { organizationId: member.organizationId, role: member.role },
    { id: userId, name: session.user.name, email: session.user.email },
  );
});

async function buildContext(
  member: { organizationId: string; role: Role },
  user: { id: string; name: string; email: string },
): Promise<TenantContext> {
  const userId = user.id;
  // Sales Manager: akses ubah/hapus mencakup anggota timnya.
  let teamUserIds: string[] = [];
  if (member.role === "sales_manager") {
    const myTeams = await prisma.teamMember.findMany({
      where: { organizationId: member.organizationId, userId },
      select: { teamId: true },
    });
    if (myTeams.length) {
      const mates = await prisma.teamMember.findMany({
        where: {
          organizationId: member.organizationId,
          teamId: { in: myTeams.map((t) => t.teamId) },
        },
        select: { userId: true },
      });
      teamUserIds = mates.map((m) => m.userId);
    }
  }

  return {
    userId,
    user,
    organizationId: member.organizationId,
    role: member.role,
    ability: defineAbilityFor({ role: member.role, userId, teamUserIds }),
    db: forTenant(prisma, member.organizationId),
  };
}

/**
 * Konteks tenant untuk pekerjaan latar (tanpa session), mis. laporan terjadwal: dibangun dari
 * keanggotaan aktif di database sehingga izin sama persis dengan saat pengguna login.
 * Null bila pengguna bukan anggota aktif organisasi itu.
 */
export async function getMemberContext(
  organizationId: string,
  userId: string,
): Promise<TenantContext | null> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId, active: true, organization: { deletedAt: null } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!member || !isRole(member.role)) return null;
  return buildContext({ organizationId, role: member.role }, member.user);
}

/** Untuk halaman/aksi privat: login + punya organisasi aktif. */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) {
    const session = await getSession();
    redirect(session ? "/onboarding" : "/login");
  }
  return ctx;
}
