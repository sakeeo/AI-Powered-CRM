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
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { encryptSecret } from "../src/lib/crypto";
import { normalizePhone } from "../src/lib/phone";
import { calculateQuotation } from "../src/modules/quotations/calc";
import { DEFAULT_LEAD_SOURCES } from "../src/modules/leads/constants";
import { DEFAULT_PIPELINE_NAME, DEFAULT_STAGES } from "../src/modules/deals/constants";
import { LOST_CATEGORIES } from "../src/modules/reports/constants";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "ig.muhammadlim@gmail.com";
const ORG_NAME = "RAHMAT ALAM MOTOR";
const ORG_SLUG = "rahmat-alam-motor";

// ---------- util ----------
let _s = 20261112;
const rnd = () => {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number, jitterHours = 0) =>
  new Date(now - d * DAY - (jitterHours ? int(0, jitterHours) * 3_600_000 : 0));
const daysAhead = (d: number) => new Date(now + d * DAY);
const dateOnly = (d: Date) => new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
const phone = () =>
  `08${pick(["12", "13", "21", "31", "52", "57", "77", "81", "95"])}${int(1000000, 9999999)}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
const money = (n: number) => new Prisma.Decimal(n);
const ids = (n: number) => Array.from({ length: n }, () => randomUUID());

// ---------- data master ----------
const PEOPLE = [
  "Rahmat Hidayat",
  "Siti Nurhaliza",
  "Agus Prasetyo",
  "Dewi Lestari",
  "Budi Santoso",
  "Rina Marlina",
  "Eko Wahyudi",
  "Yuni Astuti",
  "Hendra Gunawan",
  "Fitri Handayani",
  "Andi Saputra",
  "Maya Kusuma",
  "Dimas Pratama",
  "Lina Permata",
  "Rizky Ramadhan",
  "Ayu Wulandari",
  "Fajar Nugroho",
  "Sari Indah",
  "Bayu Setiawan",
  "Nanda Putri",
  "Joko Widodo Putra",
  "Wahyu Hidayatullah",
  "Tri Handoko",
  "Intan Maharani",
  "Galih Permana",
  "Reza Firmansyah",
  "Putri Ayuningtyas",
  "Bagus Santosa",
  "Citra Dewanti",
  "Arif Rahman",
  "Dian Puspita",
  "Hadi Kurniawan",
  "Lestari Ningsih",
  "Yoga Aditya",
  "Mega Safitri",
  "Teguh Wibowo",
  "Novita Sari",
  "Irfan Maulana",
  "Ratna Kumala",
  "Surya Dharma",
  "Erwin Susanto",
  "Nia Ramadani",
  "Slamet Riyadi",
  "Anita Fauziah",
  "Zainal Abidin",
  "Wulan Sari",
  "Ferry Irawan",
  "Desi Anggraini",
  "Taufik Hidayat",
  "Mira Oktaviani",
];
const CITIES = [
  "Surabaya",
  "Sidoarjo",
  "Gresik",
  "Malang",
  "Mojokerto",
  "Pasuruan",
  "Jombang",
  "Lamongan",
];
const STREETS = [
  "Jl. Raya Darmo",
  "Jl. Ahmad Yani",
  "Jl. Diponegoro",
  "Jl. Mayjen Sungkono",
  "Jl. Raya Gubeng",
  "Jl. Kenjeran",
  "Jl. Rungkut Industri",
  "Jl. Raya Waru",
  "Jl. Pahlawan",
  "Jl. Basuki Rahmat",
];

const COMPANIES: { name: string; industry: string }[] = [
  { name: "CV Maju Jaya Ekspedisi", industry: "Logistik & Ekspedisi" },
  { name: "PT Cepat Antar Nusantara", industry: "Kurir" },
  { name: "Koperasi Ojek Online Arek Suroboyo", industry: "Transportasi Online" },
  { name: "PT Sinar Terang Distribusi", industry: "Distribusi FMCG" },
  { name: "UD Berkah Motor Rental", industry: "Rental Kendaraan" },
  { name: "CV Surya Rental Sidoarjo", industry: "Rental Kendaraan" },
  { name: "Universitas Dian Nusantara", industry: "Pendidikan" },
  { name: "PT Garuda Pangan Sejahtera", industry: "Makanan & Minuman" },
  { name: "Toko Sumber Rejeki", industry: "Ritel" },
  { name: "PT Mitra Boga Lestari", industry: "Restoran" },
  { name: "CV Karya Mandiri Teknik", industry: "Jasa Teknik" },
  { name: "Puskesmas Kenjeran", industry: "Kesehatan" },
  { name: "PT Nusa Agro Mandiri", industry: "Agribisnis" },
  { name: "Koperasi Karyawan Bumi Persada", industry: "Koperasi" },
  { name: "CV Delta Pratama Laundry", industry: "Laundry" },
  { name: "PT Rajawali Kurir Express", industry: "Kurir" },
  { name: "Apotek Sehat Sentosa", industry: "Farmasi" },
  { name: "PT Samudra Frozen Food", industry: "Makanan & Minuman" },
  { name: "SMK Negeri 5 Surabaya", industry: "Pendidikan" },
  { name: "CV Bintang Timur Konstruksi", industry: "Konstruksi" },
  { name: "Bengkel Mandiri Jaya", industry: "Otomotif" },
  { name: "PT Tirta Segar Depot", industry: "Air Minum" },
  { name: "Komunitas Vario Club Surabaya", industry: "Komunitas" },
  { name: "PT Lintas Gresik Logistik", industry: "Logistik & Ekspedisi" },
];

const CATEGORIES = [
  "Honda Matic",
  "Honda Sport & Bebek",
  "Yamaha Matic",
  "Yamaha Sport",
  "Sparepart Mesin",
  "Sparepart Kaki-kaki",
  "Oli & Cairan",
  "Aksesoris & Perlengkapan",
  "Servis & Perawatan",
  "Paket Fleet",
];
const PRODUCTS: [string, string, number, string][] = [
  // [nama, kategori, harga, sku]
  ["Honda Vario 125 CBS", "Honda Matic", 23_900_000, "HND-VAR125"],
  ["Honda Vario 160 ABS", "Honda Matic", 30_800_000, "HND-VAR160"],
  ["Honda BeAT Street", "Honda Matic", 19_100_000, "HND-BEAT"],
  ["Honda Scoopy Prestige", "Honda Matic", 24_200_000, "HND-SCOOPY"],
  ["Honda PCX 160 CBS", "Honda Matic", 32_900_000, "HND-PCX160"],
  ["Honda ADV 160 ABS", "Honda Matic", 38_500_000, "HND-ADV160"],
  ["Honda Genio CBS", "Honda Matic", 19_800_000, "HND-GENIO"],
  ["Honda Revo X", "Honda Sport & Bebek", 16_600_000, "HND-REVO"],
  ["Honda Supra GTR 150", "Honda Sport & Bebek", 27_400_000, "HND-GTR150"],
  ["Honda CB150R Streetfire", "Honda Sport & Bebek", 30_600_000, "HND-CB150R"],
  ["Honda CRF150L", "Honda Sport & Bebek", 36_300_000, "HND-CRF150L"],
  ["Yamaha NMAX 155 Connected", "Yamaha Matic", 32_500_000, "YMH-NMAX"],
  ["Yamaha Aerox 155 Connected", "Yamaha Matic", 29_700_000, "YMH-AEROX"],
  ["Yamaha Fazzio Hybrid", "Yamaha Matic", 23_900_000, "YMH-FAZZIO"],
  ["Yamaha Lexi 125", "Yamaha Matic", 22_400_000, "YMH-LEXI"],
  ["Yamaha Grand Filano Hybrid", "Yamaha Matic", 28_900_000, "YMH-FILANO"],
  ["Yamaha Gear 125", "Yamaha Matic", 19_500_000, "YMH-GEAR"],
  ["Yamaha XSR 155", "Yamaha Sport", 37_800_000, "YMH-XSR155"],
  ["Yamaha MT-15", "Yamaha Sport", 38_900_000, "YMH-MT15"],
  ["Oli Mesin MPX2 0.8L", "Oli & Cairan", 58_000, "OLI-MPX2"],
  ["Oli Yamalube Matic 0.8L", "Oli & Cairan", 54_000, "OLI-YML"],
  ["Kampas Rem Depan Set", "Sparepart Kaki-kaki", 95_000, "SPR-KRD"],
  ["Ban Luar IRC 90/90-14", "Sparepart Kaki-kaki", 285_000, "SPR-BAN"],
  ["Aki GS Astra MF", "Sparepart Mesin", 210_000, "SPR-AKI"],
  ["Busi NGK Iridium", "Sparepart Mesin", 85_000, "SPR-BUSI"],
  ["Helm KYT Full Face", "Aksesoris & Perlengkapan", 650_000, "ACC-HELM"],
  ["Jaket Riding Touring", "Aksesoris & Perlengkapan", 480_000, "ACC-JKT"],
  ["Servis Berkala 10.000 km", "Servis & Perawatan", 175_000, "SVC-10K"],
  ["Tune Up Lengkap", "Servis & Perawatan", 250_000, "SVC-TUNE"],
  ["Paket Fleet 10 Unit BeAT", "Paket Fleet", 185_000_000, "FLT-BEAT10"],
];

const NEEDS = [
  "Motor matic untuk harian ke kantor",
  "Motor operasional kurir antar paket",
  "Armada rental motor tambahan",
  "Motor untuk driver ojek online",
  "Motor sport untuk komunitas",
  "Kredit motor DP ringan",
  "Tukar tambah motor lama",
  "Pengadaan motor operasional cabang",
  "Motor untuk anak kuliah",
  "Servis berkala dan sparepart",
];
const LOST_REASONS: Record<string, string> = {
  Harga: "Pelanggan menemukan harga on-the-road lebih murah di dealer lain.",
  Kompetitor: "Memilih merek lain karena promo cashback lebih besar.",
  "Kebutuhan berubah": "Rencana pembelian dibatalkan, kebutuhan berubah.",
  "Timing / anggaran": "Anggaran belum cair sampai kuartal berikutnya.",
  "Tidak responsif": "Pelanggan tidak merespons setelah 4 kali follow-up.",
  "Fitur / kualitas": "Stok warna/varian yang diminta tidak tersedia.",
  Lainnya: "Pindah domisili sehingga membatalkan pembelian.",
};

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
  const prev = await resetDatabase();
  const { user: ownerUser, passwordHash, created } = await ensureOwner(prev);

  // ---- organisasi ----
  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      timezone: "Asia/Jakarta",
      defaultCurrency: "IDR",
      createdAt: daysAgo(200),
    },
  });
  const orgId = org.id;
  const O = { organizationId: orgId };

  // ---- pengguna & anggota (20) ----
  const roles: string[] = [
    "admin",
    "admin",
    "sales_manager",
    "sales_manager",
    "sales_manager",
    ...Array(11).fill("sales_rep"),
    "viewer",
    "viewer",
    "viewer",
  ];
  const staff = roles.map((role, i) => ({
    id: randomUUID(),
    name: PEOPLE[i],
    email: `${slug(PEOPLE[i])}@rahmatalammotor.id`,
    role,
  }));
  await prisma.user.createMany({
    data: staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      createdAt: daysAgo(int(60, 190)),
    })),
  });
  await prisma.account.createMany({
    data: staff.map((u) => ({
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: passwordHash,
    })),
  });
  await prisma.member.create({
    data: { ...O, userId: ownerUser.id, role: "owner", createdAt: daysAgo(200) },
  });
  await prisma.member.createMany({
    data: staff.map((u) => ({
      ...O,
      userId: u.id,
      role: u.role,
      createdAt: daysAgo(int(60, 190)),
    })),
  });
  // satu anggota nonaktif sebagai contoh
  const inactive = staff.find((u) => u.role === "viewer")!;
  await prisma.member.updateMany({
    where: { organizationId: orgId, userId: inactive.id },
    data: { active: false, deactivatedAt: daysAgo(10) },
  });
  await prisma.session.updateMany({
    where: { userId: ownerUser.id },
    data: { activeOrganizationId: orgId },
  });

  const allUserIds = [ownerUser.id, ...staff.map((s) => s.id)]; // 20
  const activeStaff = staff.filter((u) => u.id !== inactive.id);
  const sellers = [
    ownerUser.id,
    ...activeStaff.filter((u) => u.role !== "viewer").map((u) => u.id),
  ];
  const reps = activeStaff
    .filter((u) => u.role === "sales_rep" || u.role === "sales_manager")
    .map((u) => u.id);

  // ---- tim ----
  const TEAMS = [
    "Showroom Surabaya",
    "Showroom Sidoarjo",
    "Fleet & B2B",
    "Sparepart & Aksesoris",
    "Servis Berkala",
    "Digital Leads",
  ];
  const teams = await Promise.all(
    TEAMS.map((name) => prisma.team.create({ data: { ...O, name, createdBy: ownerUser.id } })),
  );
  await prisma.teamMember.createMany({
    data: allUserIds.flatMap((uid, i) => {
      const t = [teams[i % teams.length]];
      if (i % 3 === 0) t.push(teams[(i + 2) % teams.length]);
      return t.map((tm) => ({ ...O, teamId: tm.id, userId: uid }));
    }),
    skipDuplicates: true,
  });

  // ---- undangan (20) ----
  const invStatus = ["pending", "pending", "accepted", "expired", "revoked"];
  await prisma.invitation.createMany({
    data: Array.from({ length: 20 }, (_, i) => {
      const name = PEOPLE[20 + i];
      const status = invStatus[i % invStatus.length];
      return {
        ...O,
        email: `${slug(name)}@gmail.com`,
        role: pick(["sales_rep", "sales_rep", "viewer", "sales_manager"]),
        status,
        inviterId: ownerUser.id,
        createdAt: daysAgo(int(1, 60)),
        expiresAt: status === "expired" ? daysAgo(int(1, 10)) : daysAhead(int(2, 7)),
      };
    }),
  });

  // ---- pengaturan quotation, webhook ----
  await prisma.quotationSettings.create({
    data: {
      ...O,
      taxLabel: "PPN",
      taxRate: money(11),
      taxInclusive: false,
      validityDays: 14,
      terms:
        "Harga belum termasuk biaya STNK/BPKB. Pembayaran maksimal 7 hari setelah penawaran disetujui. Unit tersedia sesuai stok.",
    },
  });
  const secret = `whsec_${randomBytes(32).toString("base64url")}`;
  await prisma.inboundWebhook.create({
    data: {
      ...O,
      publicId: randomBytes(18).toString("base64url"),
      secretEncrypted: encryptSecret(secret, `${orgId}:webhook_inbound`),
      maskedHint: `whsec_...${secret.slice(-4)}`,
      isActive: true,
      lastReceivedAt: daysAgo(1),
      createdBy: ownerUser.id,
    },
  });

  // ---- sumber lead ----
  const srcNames = [
    ...DEFAULT_LEAD_SOURCES.map((s) => s.name),
    "Instagram",
    "Marketplace",
    "Walk-in",
  ];
  await prisma.leadSource.createMany({
    data: srcNames.map((name) => ({
      ...O,
      name,
      isSystem: DEFAULT_LEAD_SOURCES.find((s) => s.name === name)?.isSystem ?? false,
    })),
  });
  const sources = await prisma.leadSource.findMany({ where: { organizationId: orgId } });
  const webhookSource = sources.find((s) => s.name === "Website")!;

  // ---- pipeline & stage ----
  const mainPipe = await prisma.pipeline.create({
    data: { ...O, name: DEFAULT_PIPELINE_NAME, isDefault: true, createdAt: daysAgo(200) },
  });
  const fleetPipe = await prisma.pipeline.create({
    data: { ...O, name: "Fleet & B2B", createdAt: daysAgo(150) },
  });
  const mainStages = [];
  for (const [i, s] of DEFAULT_STAGES.entries()) {
    mainStages.push(
      await prisma.pipelineStage.create({
        data: {
          ...O,
          pipelineId: mainPipe.id,
          name: s.name,
          position: i + 1,
          probability: s.probability,
        },
      }),
    );
  }
  const fleetStages = [];
  for (const [i, s] of [
    { name: "Inquiry", probability: 10 },
    { name: "Survey & Penawaran", probability: 30 },
    { name: "Negosiasi Harga", probability: 60 },
    { name: "Persetujuan Kontrak", probability: 85 },
  ].entries()) {
    fleetStages.push(
      await prisma.pipelineStage.create({
        data: {
          ...O,
          pipelineId: fleetPipe.id,
          name: s.name,
          position: i + 1,
          probability: s.probability,
        },
      }),
    );
  }

  // ---- kategori & produk (30) ----
  await prisma.productCategory.createMany({ data: CATEGORIES.map((name) => ({ ...O, name })) });
  const cats = await prisma.productCategory.findMany({ where: { organizationId: orgId } });
  const catId = (n: string) => cats.find((c) => c.name === n)!.id;
  await prisma.product.createMany({
    data: PRODUCTS.map(([name, cat, price, sku], i) => ({
      ...O,
      name,
      sku,
      price: money(price),
      currency: "IDR",
      categoryId: catId(cat),
      description: cat.startsWith("Servis")
        ? "Layanan bengkel resmi RAHMAT ALAM MOTOR."
        : `${name} — tersedia di showroom RAHMAT ALAM MOTOR.`,
      isActive: i !== 16 && i !== 7 ? true : false,
      createdAt: daysAgo(int(100, 190)),
      createdBy: ownerUser.id,
    })),
  });
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, isActive: true },
  });
  const units = products.filter(
    (p) => Number(p.price) >= 15_000_000 && Number(p.price) < 100_000_000,
  );

  // ---- perusahaan (24) ----
  const companyIds = ids(COMPANIES.length);
  await prisma.company.createMany({
    data: COMPANIES.map((c, i) => ({
      id: companyIds[i],
      ...O,
      name: c.name,
      industry: c.industry,
      email: `info@${slug(c.name.replace(/^(PT|CV|UD) /, "")).replace(/\./g, "")}.co.id`,
      phone: phone(),
      website: `https://www.${slug(c.name.replace(/^(PT|CV|UD) /, "")).replace(/\./g, "")}.co.id`,
      address: `${pick(STREETS)} No. ${int(1, 220)}`,
      city: pick(CITIES),
      country: "Indonesia",
      notes: chance(0.4) ? "Pelanggan korporat potensial untuk pembelian unit berulang." : null,
      ownerId: pick(sellers),
      createdAt: daysAgo(int(20, 180)),
      createdBy: pick(sellers),
    })),
  });

  // ---- kontak (40) ----
  const contactPeople = PEOPLE.slice(0, 50).slice(10, 50); // 40 nama
  const contactIds = ids(contactPeople.length);
  const JOBS = [
    "Manajer Operasional",
    "Staf Pengadaan",
    "Pemilik Usaha",
    "Kepala Cabang",
    "Koordinator Armada",
    "Karyawan",
    "Mahasiswa",
    "Wiraswasta",
    "Driver",
    "Bendahara",
  ];
  await prisma.contact.createMany({
    data: contactPeople.map((name, i) => {
      const p = phone();
      return {
        id: contactIds[i],
        ...O,
        name,
        email: `${slug(name)}@${pick(["gmail.com", "yahoo.co.id", "outlook.com"])}`,
        phone: p,
        phoneNormalized: normalizePhone(p),
        jobTitle: pick(JOBS),
        address: `${pick(STREETS)} No. ${int(1, 220)}`,
        city: pick(CITIES),
        country: "Indonesia",
        notes: chance(0.3) ? "Lebih nyaman dihubungi lewat WhatsApp." : null,
        ownerId: pick(sellers),
        createdAt: daysAgo(int(5, 180)),
        createdBy: pick(sellers),
      };
    }),
  });
  await prisma.contactCompany.createMany({
    data: contactPeople.slice(0, 30).map((_, i) => ({
      ...O,
      contactId: contactIds[i],
      companyId: companyIds[i % companyIds.length],
      roleTitle: pick(JOBS),
      isPrimary: true,
    })),
  });

  // ---- deal (36) + stage history + produk deal ----
  const DEAL_COUNT = 36;
  const dealIds = ids(DEAL_COUNT);
  const leadIds = ids(40);
  type DealPlan = { id: string; status: "open" | "won" | "lost" };
  const plans: DealPlan[] = dealIds.map((id, i) => ({
    id,
    status: i < 22 ? "open" : i < 30 ? "won" : "lost",
  }));
  const dealsData: Prisma.DealCreateManyInput[] = [];
  const history: Prisma.DealStageHistoryCreateManyInput[] = [];
  const dealItems: Prisma.DealProductCreateManyInput[] = [];
  const dealMeta: {
    id: string;
    contactId: string;
    companyId: string | null;
    value: number;
    owner: string;
    created: Date;
    status: string;
    items: { p: (typeof products)[number]; qty: number }[];
  }[] = [];

  for (const [i, plan] of plans.entries()) {
    const b2b = i % 3 === 0;
    const pipe = b2b ? fleetPipe : mainPipe;
    const stages = b2b ? fleetStages : mainStages;
    const created = daysAgo(int(8, 170), 12);
    const contactId = contactIds[i % contactIds.length];
    const companyId = i % 4 === 3 ? null : companyIds[i % companyIds.length];
    const owner = pick(reps);
    const p1 = pick(units);
    const qty = b2b ? int(5, 20) : int(1, 2);
    const items = [{ p: p1, qty }];
    if (chance(0.45))
      items.push({ p: pick(products.filter((p) => Number(p.price) < 1_000_000)), qty: int(1, 3) });
    const value = items.reduce((s, it) => s + Number(it.p.price) * it.qty, 0);
    const lastIdx =
      plan.status === "won"
        ? stages.length - 1
        : plan.status === "lost"
          ? int(0, stages.length - 1)
          : int(0, stages.length - 1);
    const stage = stages[lastIdx];
    const closedAt =
      plan.status === "open"
        ? null
        : new Date(Math.min(now - DAY, created.getTime() + int(7, 60) * DAY));
    const lostCat = plan.status === "lost" ? pick(LOST_CATEGORIES) : null;
    dealsData.push({
      id: plan.id,
      ...O,
      title: `${b2b ? "Fleet" : "Pembelian"} ${p1.name}${qty > 1 ? ` ×${qty}` : ""} — ${companyId ? COMPANIES[i % COMPANIES.length].name : contactPeople[i % contactPeople.length]}`,
      pipelineId: pipe.id,
      stageId: stage.id,
      status: plan.status,
      value: money(value),
      currency: "IDR",
      expectedCloseDate: dateOnly(
        plan.status === "open" ? daysAhead(int(3, 60)) : (closedAt as Date),
      ),
      probability: plan.status === "open" ? stage.probability : plan.status === "won" ? 100 : 0,
      contactId,
      companyId,
      ownerId: owner,
      notes: chance(0.5)
        ? "Pelanggan minta test ride dan simulasi cicilan sebelum keputusan."
        : null,
      closedAt,
      lostReason: lostCat ? LOST_REASONS[lostCat] : null,
      lostCategory: lostCat,
      sourceLeadId: i < 8 ? leadIds[i] : null,
      createdAt: created,
      updatedAt: closedAt ?? daysAgo(int(0, 6)),
      createdBy: owner,
    });
    // riwayat perpindahan stage
    let at = created.getTime();
    history.push({
      ...O,
      dealId: plan.id,
      fromStageId: null,
      toStageId: stages[0].id,
      changedBy: owner,
      createdAt: new Date(at),
    });
    for (let s = 1; s <= lastIdx; s++) {
      at += int(1, 9) * DAY;
      history.push({
        ...O,
        dealId: plan.id,
        fromStageId: stages[s - 1].id,
        toStageId: stages[s].id,
        changedBy: owner,
        createdAt: new Date(Math.min(at, now - 3_600_000)),
      });
    }
    for (const it of items) {
      dealItems.push({
        ...O,
        dealId: plan.id,
        productId: it.p.id,
        name: it.p.name,
        quantity: it.qty,
        unitPrice: it.p.price,
        currency: "IDR",
        createdBy: owner,
        createdAt: created,
      });
    }
    dealMeta.push({
      id: plan.id,
      contactId,
      companyId,
      value,
      owner,
      created,
      status: plan.status,
      items,
    });
  }

  // ---- lead (40) ----
  const LEAD_STATUS = [
    "new",
    "new",
    "new",
    "contacted",
    "contacted",
    "contacted",
    "qualified",
    "qualified",
    "unqualified",
  ];
  const leadsData: Prisma.LeadCreateManyInput[] = leadIds.map((id, i) => {
    const name = PEOPLE[(i * 7 + 3) % PEOPLE.length];
    const converted = i < 8; // 8 lead pertama sudah dikonversi menjadi deal
    const status = converted ? "qualified" : LEAD_STATUS[i % LEAD_STATUS.length];
    const p = phone();
    const dm = converted ? dealMeta[i] : null;
    const src = i % 9 === 0 ? webhookSource : pick(sources);
    return {
      id,
      ...O,
      name,
      email: chance(0.85)
        ? `${slug(name)}${int(1, 99)}@${pick(["gmail.com", "yahoo.co.id", "outlook.com"])}`
        : null,
      phone: p,
      phoneNormalized: normalizePhone(p),
      companyName: chance(0.35) ? pick(COMPANIES).name : null,
      needs: pick(NEEDS),
      budget: money(int(8, 60) * 1_000_000),
      currency: "IDR",
      urgency: pick(["low", "medium", "high"]),
      notes: chance(0.4)
        ? "Datang dari promo akhir tahun, minta brosur dan simulasi kredit."
        : null,
      status,
      unqualifiedReason:
        status === "unqualified"
          ? pick(["Budget tidak sesuai", "Tidak ada kebutuhan", "Sudah membeli di tempat lain"])
          : null,
      sourceId: src.id,
      ownerId: chance(0.9) ? pick(reps) : null,
      archivedAt: i >= 36 ? daysAgo(int(1, 20)) : null,
      convertedAt: converted ? dm!.created : null,
      convertedContactId: converted ? dm!.contactId : null,
      convertedCompanyId: converted ? dm!.companyId : null,
      convertedDealId: converted ? dm!.id : null,
      createdAt: daysAgo(int(1, 170), 12),
      createdBy: pick(sellers),
    };
  });
  // lead konversi dibuat lebih awal dari deal-nya
  for (const [i, l] of leadsData.entries())
    if (i < 8) l.createdAt = new Date(dealMeta[i].created.getTime() - int(1, 6) * DAY);
  await prisma.lead.createMany({ data: leadsData });
  await prisma.deal.createMany({ data: dealsData });
  await prisma.dealStageHistory.createMany({ data: history });
  await prisma.dealProduct.createMany({ data: dealItems });

  // ---- quotation (24) + item ----
  const quoDeals = dealMeta.filter((d) => d.status !== "lost" || chance(0.5)).slice(0, 24);
  while (quoDeals.length < 24) quoDeals.push(dealMeta[quoDeals.length % dealMeta.length]);
  const QSTATUS = ["draft", "sent", "sent", "accepted", "accepted", "rejected", "expired"];
  const quoData: Prisma.QuotationCreateManyInput[] = [];
  const quoItems: Prisma.QuotationItemCreateManyInput[] = [];
  for (const [i, d] of quoDeals.entries()) {
    const id = randomUUID();
    const status =
      d.status === "won"
        ? "accepted"
        : d.status === "lost"
          ? pick(["rejected", "expired"])
          : QSTATUS[i % QSTATUS.length];
    const issue = new Date(d.created.getTime() + int(1, 6) * DAY);
    const issueDate = issue.getTime() > now ? daysAgo(1) : issue;
    const calcItems = d.items.map((it) => ({
      quantity: it.qty,
      unitPrice: Number(it.p.price).toFixed(2),
      discountPercent: chance(0.3) ? int(1, 5) : 0,
    }));
    const globalDiscount = chance(0.2) ? 2 : 0;
    const r = calculateQuotation(calcItems, {
      taxRate: 11,
      taxInclusive: false,
      globalDiscountPercent: globalDiscount,
    });
    quoData.push({
      id,
      ...O,
      number: `QUO-${issueDate.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`,
      title: `Penawaran ${d.items[0].p.name}`,
      status,
      dealId: d.id,
      contactId: d.contactId,
      companyId: d.companyId,
      ownerId: d.owner,
      currency: "IDR",
      issueDate: dateOnly(issueDate),
      validUntil: dateOnly(new Date(issueDate.getTime() + 14 * DAY)),
      taxLabel: "PPN",
      taxRate: money(11),
      taxInclusive: false,
      globalDiscountPercent: money(globalDiscount),
      subtotal: money(Number(r.subtotal)),
      discountTotal: money(Number(r.discountTotal)),
      taxTotal: money(Number(r.taxTotal)),
      total: money(Number(r.total)),
      notes: chance(0.4) ? "Harga berlaku selama stok tersedia." : null,
      terms:
        "Harga belum termasuk biaya STNK/BPKB. Pembayaran maksimal 7 hari setelah penawaran disetujui.",
      sentAt: status === "draft" ? null : issueDate,
      createdAt: issueDate,
      createdBy: d.owner,
    });
    d.items.forEach((it, k) =>
      quoItems.push({
        ...O,
        quotationId: id,
        position: k + 1,
        productId: it.p.id,
        name: it.p.name,
        description: null,
        quantity: money(it.qty),
        unitPrice: it.p.price,
        discountPercent: money(Number(calcItems[k].discountPercent)),
        lineTotal: money(Number(r.lines[k].net)),
      }),
    );
  }
  await prisma.quotation.createMany({ data: quoData });
  await prisma.quotationItem.createMany({ data: quoItems });

  // ---- aktivitas (50) ----
  const ACT: [string, string][] = [
    ["call", "Telepon follow-up penawaran"],
    ["meeting", "Test ride di showroom"],
    ["email", "Kirim brosur & simulasi kredit"],
    ["task", "Siapkan dokumen leasing"],
    ["note", "Catatan hasil kunjungan pelanggan"],
    ["call", "Konfirmasi ketersediaan stok warna"],
    ["meeting", "Presentasi paket fleet ke manajemen"],
    ["task", "Update harga on-the-road"],
  ];
  await prisma.activity.createMany({
    data: Array.from({ length: 50 }, (_, i) => {
      const [type, subject] = ACT[i % ACT.length];
      const roll = i % 5;
      const status =
        roll === 0 || roll === 1 ? "done" : roll === 4 && i % 10 === 4 ? "cancelled" : "open";
      const due =
        status === "open"
          ? i % 2 === 0
            ? daysAgo(int(1, 8))
            : daysAhead(int(0, 14))
          : daysAgo(int(1, 40));
      const link: Record<string, string | null> =
        i % 4 === 0
          ? { leadId: leadIds[i % 40] }
          : i % 4 === 1
            ? { contactId: contactIds[i % 40] }
            : i % 4 === 2
              ? { dealId: dealIds[i % DEAL_COUNT] }
              : { companyId: companyIds[i % companyIds.length] };
      return {
        ...O,
        type,
        subject: type === "note" ? subject : `${subject} #${i + 1}`,
        body: chance(0.5)
          ? "Pelanggan tertarik, menunggu keputusan pasangan. Jadwalkan ulang pekan depan."
          : null,
        status,
        dueAt: type === "note" ? null : due,
        completedAt: status === "done" ? due : null,
        ownerId: pick(reps),
        createdAt: daysAgo(int(1, 60)),
        createdBy: pick(sellers),
        ...link,
      };
    }),
  });

  // ---- feedback & complaint (22) ----
  const FB: [string, string, string][] = [
    [
      "feedback",
      "Pelayanan sales ramah dan informatif",
      "Terima kasih, proses pembelian cepat dan jelas.",
    ],
    [
      "complaint",
      "Motor baru terlambat dikirim",
      "Unit dijanjikan 3 hari tetapi baru tiba 8 hari.",
    ],
    [
      "complaint",
      "Antrean servis terlalu lama",
      "Menunggu lebih dari 2 jam padahal sudah booking.",
    ],
    [
      "feedback",
      "Usul tambah slot servis akhir pekan",
      "Banyak pelanggan hanya bisa servis di hari Sabtu/Minggu.",
    ],
    [
      "complaint",
      "STNK belum selesai melebihi estimasi",
      "Sudah 3 minggu belum ada kabar dari bagian administrasi.",
    ],
    ["feedback", "Harga sparepart kompetitif", "Perbandingan dengan toko lain cukup bersaing."],
  ];
  await prisma.feedback.createMany({
    data: Array.from({ length: 22 }, (_, i) => {
      const [type, subject, body] = FB[i % FB.length];
      const resolved = i % 3 !== 0;
      const created = daysAgo(int(2, 90));
      return {
        ...O,
        type,
        subject: `${subject}${i >= FB.length ? ` (${i + 1})` : ""}`,
        body,
        status: resolved ? "resolved" : "open",
        contactId: contactIds[i % 40],
        companyId: i % 2 === 0 ? companyIds[i % companyIds.length] : null,
        dealId: i % 3 === 1 ? dealIds[i % DEAL_COUNT] : null,
        ownerId: pick(reps),
        resolvedAt: resolved ? new Date(created.getTime() + int(1, 5) * DAY) : null,
        createdAt: created,
        createdBy: pick(sellers),
      };
    }),
  });

  // ---- segmen pelanggan (8) + anggota (24) ----
  const SEG = [
    "VIP",
    "Pelanggan Loyal",
    "Fleet / B2B",
    "Ojol & Kurir",
    "Pelanggan Baru",
    "Berisiko Churn",
    "Komunitas Motor",
    "Mahasiswa",
  ];
  await prisma.customerSegment.createMany({ data: SEG.map((name) => ({ ...O, name })) });
  const segs = await prisma.customerSegment.findMany({ where: { organizationId: orgId } });
  await prisma.customerSegmentMember.createMany({
    data: Array.from({ length: 24 }, (_, i) => {
      const seg = segs[i % segs.length];
      return i % 3 === 2
        ? { ...O, segmentId: seg.id, companyId: companyIds[i % companyIds.length] }
        : { ...O, segmentId: seg.id, contactId: contactIds[i % 40] };
    }),
    skipDuplicates: true,
  });

  // ---- notifikasi (25) + preferensi (20) ----
  const NOTI: [string, string, string, string][] = [
    [
      "activity_overdue",
      "Terlambat: Telepon follow-up penawaran",
      "Aktivitas melewati jatuh tempo.",
      "/activities",
    ],
    [
      "activity_due_soon",
      "Segera jatuh tempo: Test ride di showroom",
      "Jatuh tempo dalam 24 jam.",
      "/activities",
    ],
    [
      "quotation_expiring",
      "Quotation segera kedaluwarsa",
      "Penawaran berlaku sampai 2 hari lagi.",
      "/quotations",
    ],
    [
      "lead_assigned",
      "Lead baru ditugaskan kepada Anda",
      "Lead dari Instagram menunggu respons.",
      "/leads",
    ],
    ["deal_won", "Deal dimenangkan 🎉", "Pembelian unit disetujui pelanggan.", "/deals"],
  ];
  await prisma.notification.createMany({
    data: Array.from({ length: 25 }, (_, i) => {
      const [type, title, body, link] = NOTI[i % NOTI.length];
      return {
        ...O,
        userId: i < 8 ? ownerUser.id : allUserIds[i % allUserIds.length],
        type,
        title,
        body,
        link,
        dedupeKey: `seed:${type}:${i}`,
        readAt: i % 3 === 0 ? daysAgo(int(0, 3)) : null,
        createdAt: daysAgo(int(0, 14), 12),
      };
    }),
  });
  await prisma.notificationPreference.createMany({
    data: allUserIds.map((userId, i) => ({ ...O, userId, inApp: true, email: i % 4 !== 0 })),
  });

  // ---- webhook delivery (22), ai log (25) ----
  await prisma.webhookDelivery.createMany({
    data: Array.from({ length: 22 }, (_, i) => {
      const ok = i % 5 !== 4;
      return {
        ...O,
        status: ok ? "accepted" : i % 2 ? "rejected" : "invalid",
        httpStatus: ok ? 201 : i % 2 ? 401 : 422,
        error: ok ? null : i % 2 ? "Signature tidak valid" : "Nama atau kontak wajib diisi",
        leadId: ok ? leadIds[i % 40] : null,
        ipAddress: `103.${int(10, 250)}.${int(1, 250)}.${int(1, 250)}`,
        createdAt: daysAgo(int(0, 30), 12),
      };
    }),
  });
  await prisma.aiCallLog.createMany({
    data: Array.from({ length: 25 }, (_, i) => ({
      ...O,
      userId: pick(reps),
      feature: pick([
        "followup_ghostwriter",
        "lost_reason_categorizer",
        "text_to_lead",
        "activity_summary",
      ]),
      provider: pick(["openai", "anthropic", "gemini"]),
      model: pick(["gpt-4o-mini", "claude-haiku-4-5", "gemini-2.0-flash"]),
      status: i % 8 === 7 ? "error" : "ok",
      durationMs: int(600, 4200),
      createdAt: daysAgo(int(0, 30), 12),
    })),
  });

  // ---- audit log (≥ 80) ----
  const audit: Prisma.AuditLogCreateManyInput[] = [];
  const A = (
    action: string,
    entityType: string,
    entityId: string,
    actor: string,
    at: Date,
    after?: object,
  ) =>
    audit.push({
      ...O,
      action,
      entityType,
      entityId,
      actorId: actor,
      after: after as Prisma.InputJsonValue,
      ipAddress: "103.28.12.10",
      userAgent: "Mozilla/5.0 (seed)",
      createdAt: at,
    });
  for (const l of leadsData.slice(0, 20))
    A("lead.created", "Lead", l.id!, l.createdBy!, l.createdAt as Date, { name: l.name });
  for (const d of dealsData)
    A("deal.created", "Deal", d.id!, d.createdBy!, d.createdAt as Date, { title: d.title });
  for (const d of dealsData.filter((x) => x.status === "won"))
    A("deal.won", "Deal", d.id!, d.ownerId!, d.closedAt as Date);
  for (const d of dealsData.filter((x) => x.status === "lost"))
    A("deal.lost", "Deal", d.id!, d.ownerId!, d.closedAt as Date, { category: d.lostCategory });
  for (const q of quoData.slice(0, 12))
    A("quotation.created", "Quotation", q.id!, q.createdBy!, q.createdAt as Date, {
      number: q.number,
    });
  A("lead.converted", "Lead", leadIds[0], ownerUser.id, daysAgo(30));
  A("invitation.created", "Invitation", randomUUID(), ownerUser.id, daysAgo(12));
  A("webhook.created", "Connector", orgId, ownerUser.id, daysAgo(40));
  await prisma.auditLog.createMany({ data: audit });

  console.log(`\nSeed OK — workspace "${ORG_NAME}" (${orgId})`);
  console.log(
    `  Owner: ${OWNER_EMAIL} ${created ? `(dibuat baru; password: ${process.env.SEED_OWNER_PASSWORD ?? "Demo12345!"})` : "(password lama dipertahankan)"}`,
  );
  console.log(`  Pengguna demo lain memakai password yang sama; contoh: ${staff[2].email}`);
  const counts = {
    members: 20,
    teams: teams.length,
    invitations: 20,
    companies: COMPANIES.length,
    contacts: contactIds.length,
    leads: leadIds.length,
    deals: DEAL_COUNT,
    stageHistory: history.length,
    dealProducts: dealItems.length,
    products: PRODUCTS.length,
    quotations: quoData.length,
    quotationItems: quoItems.length,
    activities: 50,
    feedbacks: 22,
    segmentMembers: 24,
    notifications: 25,
    webhookDeliveries: 22,
    aiCallLogs: 25,
    auditLogs: audit.length,
  };
  console.log("  Jumlah baris:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
