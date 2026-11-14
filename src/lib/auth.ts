import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import {
  hasPendingInvitation,
  ownerExists,
  SIGNUP_CLOSED_CODE,
} from "@/modules/organizations/server/setup";
import { prisma } from "@/lib/prisma";
import { orgPluginAc, orgPluginRoles } from "@/lib/roles";
import { redis } from "@/lib/redis";

const requireVerification = env.REQUIRE_EMAIL_VERIFICATION === true;

/** Batas khusus endpoint sensitif (PRD §9.1): [jendela detik, maksimum request] per IP. */
export const AUTH_RATE_LIMITS = {
  "/sign-in/email": { window: 60, max: 5 },
  "/sign-up/email": { window: 60, max: 5 },
  "/request-password-reset": { window: 600, max: 3 },
  "/forget-password": { window: 600, max: 3 },
  "/reset-password": { window: 600, max: 5 },
} as const;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Redis dipakai untuk rate limit; sesi tetap disimpan di PostgreSQL (sumber kebenaran).
  secondaryStorage: {
    get: (key) => redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, "EX", ttl);
      else await redis.set(key, value);
    },
    delete: async (key) => {
      await redis.del(key);
    },
    getAndDelete: (key) => redis.getdel(key),
    // INCR atomik; TTL hanya dipasang saat counter dibuat (jendela rate limit tetap).
    increment: async (key, ttl) => {
      const value = await redis.incr(key);
      if (value === 1) await redis.expire(key, ttl);
      return value;
    },
  },
  session: { storeSessionInDatabase: true, expiresIn: 60 * 60 * 24 * 7 },
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 100,
    customRules: { ...AUTH_RATE_LIMITS },
  },
  // Id dibuat database (UUID v7, lihat docs/database.md).
  advanced: { database: { generateId: false } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: requireVerification,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      // Tidak di-await agar waktu respons tidak membocorkan apakah email terdaftar.
      void sendMail({
        to: user.email,
        subject: "Reset password Kerabat CRM",
        text: `Halo ${user.name},\n\nBuka tautan berikut untuk mengatur ulang password (berlaku 1 jam):\n${url}\n\nAbaikan email ini bila Anda tidak memintanya.`,
      }).catch((err) => logger.error({ err }, "Gagal mengirim email reset password"));
    },
  },
  emailVerification: {
    sendOnSignUp: requireVerification,
    sendVerificationEmail: async ({ user, url }) => {
      void sendMail({
        to: user.email,
        subject: "Verifikasi email Kerabat CRM",
        text: `Halo ${user.name},\n\nVerifikasi email Anda: ${url}`,
      }).catch((err) => logger.error({ err }, "Gagal mengirim email verifikasi"));
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Pendaftaran hanya untuk setup awal (belum ada Owner) atau calon anggota yang diundang.
        before: async (user) => {
          if ((await ownerExists()) && !(await hasPendingInvitation(user.email))) {
            throw new APIError("FORBIDDEN", {
              code: SIGNUP_CLOSED_CODE,
              message: "Pendaftaran ditutup. Minta undangan dari Owner atau Admin.",
            });
          }
        },
      },
    },
    session: {
      create: {
        // Sesi baru langsung memakai organisasi aktif pertama milik pengguna (bila ada).
        before: async (session) => {
          const member = await prisma.member.findFirst({
            where: { userId: session.userId, active: true },
            orderBy: { createdAt: "asc" },
            select: { organizationId: true },
          });
          return { data: { ...session, activeOrganizationId: member?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    organization({
      ac: orgPluginAc,
      roles: orgPluginRoles,
      creatorRole: "owner",
      requireEmailVerificationOnInvitation: requireVerification,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async ({ id, email, role, organization, inviter }) => {
        const url = `${env.BETTER_AUTH_URL}/accept-invitation/${id}`;
        void sendMail({
          to: email,
          subject: `Undangan bergabung ke ${organization.name}`,
          text: `${inviter.user.name} mengundang Anda bergabung ke ${organization.name} sebagai ${role}.\n\nTerima undangan (berlaku 7 hari): ${url}`,
        }).catch((err) => logger.error({ err }, "Gagal mengirim email undangan"));
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
