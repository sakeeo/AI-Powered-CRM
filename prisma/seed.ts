/**
 * Seed data demo — workspace "RAHMAT ALAM MOTOR" (dealer & bengkel motor).
 *
 * `npm run db:seed` RESET total database lalu mengisi data baru:
 *  - Semua organisasi (beserta seluruh data tenant) dan semua pengguna selain owner demo DIHAPUS.
 *  - Owner demo (SEED_OWNER_EMAIL, default ig.muhammadlim@gmail.com) dan baris `accounts`-nya
 *    (hash password) TIDAK dihapus → password owner tetap sama. Bila owner belum ada, dibuat dengan
 *    password SEED_OWNER_PASSWORD (default "Demo12345!").
 *  - 19 pengguna demo lain memakai password yang sama dengan owner.
 * Data deterministik (PRNG ber-seed) agar hasilnya konsisten antar-run; tanggal relatif terhadap "hari ini".
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { createDemoWorkspace } from "../src/modules/organizations/server/demo-workspace";
import { DEMO_PROFILES } from "../src/modules/organizations/server/demo-profiles";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "ig.muhammadlim@gmail.com";
/** Jenis usaha data demo: SEED_BUSINESS=dealer (default) | travel. */
const BUSINESS = process.env.SEED_BUSINESS === "travel" ? "travel" : "dealer";
const ORG_NAME = DEMO_PROFILES[BUSINESS].orgName;
const ORG_SLUG = BUSINESS === "travel" ? "amanah-tour-travel" : "rahmat-alam-motor";
const EMAIL_DOMAIN = BUSINESS === "travel" ? "amanahtour.id" : "rahmatalammotor.id";

// ---------- pengaman produksi ----------
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Seed MENGHAPUS semua organisasi & pengguna (kecuali owner demo). Di produksi hanya berjalan bila
 * disengaja (SEED_ALLOW_PRODUCTION=true) dan dengan password owner/pengguna demo yang kuat
 * (SEED_OWNER_PASSWORD ≥ 12 karakter), agar tidak memakai password default yang diketahui umum.
 */
function assertSafeToSeed() {
  if (!IS_PRODUCTION) return;
  if (process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Seed dibatalkan: NODE_ENV=production. Seed menghapus SEMUA organisasi & pengguna. " +
        "Set SEED_ALLOW_PRODUCTION=true bila benar-benar disengaja (backup dulu).",
    );
  }
  const pw = process.env.SEED_OWNER_PASSWORD ?? "";
  if (pw.length < 12) {
    throw new Error(
      "Seed dibatalkan: SEED_OWNER_PASSWORD wajib diisi (minimal 12 karakter) di produksi.",
    );
  }
}

// ---------- reset ----------
async function resetDatabase() {
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    include: { accounts: { where: { providerId: "credential" } } },
  });
  // Cascade menghapus seluruh data tenant, anggota, undangan, tim, notifikasi, dst.
  const orgs = await prisma.organization.deleteMany({});
  const users = await prisma.user.deleteMany({ where: owner ? { id: { not: owner.id } } : {} });
  await prisma.verification.deleteMany({});
  console.log(
    `Reset: ${orgs.count} organisasi & ${users.count} pengguna dihapus (owner demo dipertahankan).`,
  );
  return owner;
}

async function ensureOwner(existing: Awaited<ReturnType<typeof resetDatabase>>) {
  if (existing) {
    const hash = existing.accounts[0]?.password;
    if (!hash) throw new Error("Owner demo tidak punya akun credential/password");
    return { user: existing, passwordHash: hash, created: false };
  }
  const passwordHash = await hashPassword(process.env.SEED_OWNER_PASSWORD ?? "Demo12345!");
  const user = await prisma.user.create({
    data: { name: "Owner Demo", email: OWNER_EMAIL, emailVerified: true },
  });
  await prisma.account.create({
    data: { accountId: user.id, providerId: "credential", userId: user.id, password: passwordHash },
  });
  return { user: { ...user, accounts: [] }, passwordHash, created: true };
}

async function main() {
  assertSafeToSeed();
  const prev = await resetDatabase();
  const { user: ownerUser, passwordHash, created } = await ensureOwner(prev);

  const { orgId, counts, sampleStaffEmail } = await prisma.$transaction(
    (tx) =>
      createDemoWorkspace(tx, {
        ownerUserId: ownerUser.id,
        orgName: ORG_NAME,
        orgSlug: ORG_SLUG,
        emailDomain: EMAIL_DOMAIN,
        business: BUSINESS,
        passwordHash,
      }),
    { timeout: 180_000, maxWait: 20_000 },
  );
  await prisma.session.updateMany({
    where: { userId: ownerUser.id },
    data: { activeOrganizationId: orgId },
  });

  console.log(`\nSeed OK — workspace "${ORG_NAME}" (${orgId})`);
  console.log(
    `  Owner: ${OWNER_EMAIL} ${created ? (IS_PRODUCTION ? "(dibuat baru; password = SEED_OWNER_PASSWORD)" : `(dibuat baru; password: ${process.env.SEED_OWNER_PASSWORD ?? "Demo12345!"})`) : "(password lama dipertahankan)"}`,
  );
  console.log(`  Pengguna demo lain memakai password yang sama; contoh: ${sampleStaffEmail}`);

  console.log("  Jumlah baris:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
