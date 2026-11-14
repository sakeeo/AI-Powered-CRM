import { prisma } from "@/lib/prisma";

/**
 * `PUBLIC_SIGNUP=true` → pendaftaran selalu terbuka (mode SaaS: setiap pendaftar membuat workspace
 * sendiri). Default tertutup setelah Owner pertama ada. Dibaca saat dipanggil (bukan saat import).
 */
export const publicSignupEnabled = () => process.env.PUBLIC_SIGNUP === "true";

/** Kode error yang dikembalikan server saat pendaftaran ditutup (dipetakan ke pesan di `authErrorMessage`). */
export const SIGNUP_CLOSED_CODE = "SIGNUP_CLOSED";

/**
 * Setup awal selesai bila sudah ada minimal satu akun Owner aktif (di organisasi mana pun).
 * Workspace yang dihapus (soft delete) sengaja TETAP dihitung: menghapus workspace terakhir tidak
 * boleh membuka kembali pendaftaran publik — Owner tetap bisa membuat workspace baru lewat onboarding.
 */
export async function ownerExists(): Promise<boolean> {
  return (await prisma.member.count({ where: { role: "owner", active: true }, take: 1 })) > 0;
}

/** Undangan yang masih berlaku untuk email ini (anggota baru mendaftar lewat undangan). */
export async function hasPendingInvitation(email: string): Promise<boolean> {
  const inv = await prisma.invitation.findFirst({
    where: {
      email: { equals: email.trim(), mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
      organization: { deletedAt: null },
    },
    select: { id: true },
  });
  return Boolean(inv);
}

/** Email pada undangan pending berdasarkan id (untuk mengisi form daftar dari tautan undangan). */
export async function pendingInvitationEmail(invitationId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return null;
  const inv = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      status: "pending",
      expiresAt: { gt: new Date() },
      organization: { deletedAt: null },
    },
    select: { email: true },
  });
  return inv?.email ?? null;
}

/**
 * Aturan pendaftaran: terbuka HANYA selama belum ada Owner (setup awal). Setelah itu pendaftaran
 * ditutup; satu-satunya pengecualian adalah calon anggota yang punya undangan pending.
 * Mengembalikan email undangan (bila datang dari tautan undangan) agar form dapat mengisinya.
 */
export async function signUpAccess(
  next: string | undefined,
): Promise<{ open: boolean; invitedEmail: string | null }> {
  if (publicSignupEnabled() || !(await ownerExists())) return { open: true, invitedEmail: null };
  const m = next?.match(/^\/accept-invitation\/([^/?#]+)/);
  const invitedEmail = m ? await pendingInvitationEmail(m[1]) : null;
  return { open: invitedEmail !== null, invitedEmail };
}
