# Kerabat CRM

_Pantau setiap lead hingga konversi._

Kerabat CRM adalah CRM berbasis cloud (multi-tenant, SaaS-ready) untuk Lead Acquisition, Sales Conversion, dan Customer Retention. Lihat [docs/PRD.md](docs/PRD.md).

## Dokumen proyek

- [docs/PRD.md](docs/PRD.md) — Product Requirements Document
- [docs/phase/](docs/phase) — pembagian phase pengembangan
- [docs/plans/](docs/plans) — plan kerja per phase (`plan.<phase>.<nomor>.md`)
- [docs/PROGRESS.md](docs/PROGRESS.md) — status pengerjaan plan
- [docs/decisions.md](docs/decisions.md) — keputusan produk & teknis
- [docs/database.md](docs/database.md) — konvensi database, tenant scope, migrasi
- [docs/deployment.md](docs/deployment.md) — runbook deployment production (VPS, Docker Compose, backup, rollback)
- [docs/design-system.md](docs/design-system.md) — **satu-satunya** referensi desain UI/UX (acuan: template [docs/spike-tailwind](docs/spike-tailwind))

## Prasyarat

Node.js 22+, npm, Docker (Compose).

## Menjalankan

```bash
cp .env.example .env        # lalu sesuaikan nilainya
npm run infra:up           # PostgreSQL :5434, Redis :6380, MinIO :9100 (console :9101) + bucket
npm ci
npx prisma migrate dev      # terapkan migrasi
npm run dev                 # http://localhost:3000
```

## Script

| Script                  | Fungsi                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`           | Development server                                                           |
| `npm run build`         | Build production                                                             |
| `npm run lint`          | ESLint                                                                       |
| `npm run typecheck`     | Generate route types + `tsc --noEmit`                                        |
| `npm run format`        | Prettier (tulis)                                                             |
| `npm run format:check`  | Prettier (cek saja)                                                          |
| `npm test`              | Vitest (unit + integration)                                                  |
| `npm run test:e2e`      | Playwright E2E (jalankan `npm run build` dulu; `npm run e2e:install` sekali) |
| `npm run worker`        | Worker BullMQ (email + reminder task); jalankan bersama `npm run dev`        |
| `npm run db:migrate`    | Migrasi dev (`prisma migrate dev`)                                           |
| `npm run db:seed`       | Seed data demo                                                               |
| `npm run db:test:setup` | Siapkan database `crm_test`                                                  |
| `npm run infra:up`      | Nyalakan Postgres, Redis, MinIO + bucket                                     |
| `npm run infra:down`    | Matikan infrastruktur                                                        |
| `npm run infra:reset`   | Hapus volume & nyalakan ulang                                                |

## Struktur folder

```text
src/
├── app/               # Next.js App Router (routes, layout)
├── components/        # komponen UI bersama
├── lib/               # util bersama (env, prisma, ...)
├── modules/<modul>/   # modular monolith
│   ├── components/    #   UI khusus modul
│   ├── server/        #   logika server (query, service, handler)
│   ├── schemas/       #   skema Zod (dipakai client + server)
│   └── types/
└── generated/         # Prisma Client (di-ignore, dibuat oleh `prisma generate`)
prisma/                # schema & migrasi
docs/                  # PRD, phase, plan, progress
```

## Infrastruktur lokal

| Service    | Container      | Host port      |
| ---------- | -------------- | -------------- |
| PostgreSQL | `crm-postgres` | 5434           |
| Redis      | `crm-redis`    | 6380           |
| MinIO (S3) | `crm-minio`    | 9100 (UI 9101) |

Port sengaja tidak standar agar tidak bentrok dengan project lain. Cek kesehatan: `GET /api/health`.

## Docker image

```bash
docker build -t crm:local .
```

Image multi-stage (Next.js standalone, user non-root, healthcheck `/api/health`). Env runtime wajib diberikan saat `docker run` (lihat `.env.example`); `docker --env-file` tidak menghapus tanda kutip, jadi tulis nilai tanpa kutip.

## Deploy ke VPS

Arsitektur: satu VPS dengan Docker Compose — **Caddy** (HTTPS otomatis, hanya port 80/443 terbuka) → **app** (Next.js) + **worker** (BullMQ) + **PostgreSQL** + **Redis** + **MinIO**. Detail lengkap, monitoring, dan rollback: [docs/deployment.md](docs/deployment.md).

**Prasyarat:** Linux ≥ 2 vCPU / 4 GB RAM / 40 GB disk dengan Docker + Compose v2, domain dengan A record ke IP server, firewall hanya 22/80/443. Kode sudah di-commit dan di-push (server mengambil kode lewat `git clone`).

```bash
# 1. Ambil kode & isi env (buat nilai acak: openssl rand -base64 32)
git clone https://github.com/sakeeo/AI-Powered-CRM.git /opt/crm && cd /opt/crm
cp .env.production.example .env.production && chmod 600 .env.production

# 2. Build & jalankan (migrasi database berjalan otomatis sebelum app naik)
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 3. Verifikasi
curl -fsS https://$APP_DOMAIN/api/health
```

Setelah itu:

1. Buka `https://<domain>/sign-up` **segera** dan daftar sebagai Owner. Pendaftaran hanya terbuka selama belum ada Owner; setelah itu ditutup (anggota baru bergabung lewat undangan). Untuk mode SaaS (siapa pun boleh mendaftar dan membuat workspace sendiri), set `PUBLIC_SIGNUP=true` di `.env.production`.
2. Atur **Settings → Connectors → Email Delivery** dan kirim email uji (dibutuhkan untuk undangan & reset password), lalu AI/WhatsApp bila perlu.
3. Jadwalkan backup harian (`scripts/backup.sh`, lihat [docs/backup-restore.md](docs/backup-restore.md)) dan pasang uptime monitor pada `/api/health`.

> **Simpan `ENCRYPTION_KEY` dan `BACKUP_PASSPHRASE` di password manager, terpisah dari server.** `ENCRYPTION_KEY` hilang = semua API key/secret connector tidak dapat didekripsi; `BACKUP_PASSPHRASE` hilang = backup tidak dapat dibuka.

**Data demo di produksi (opsional, destruktif):** seed **menghapus semua organisasi & pengguna** (kecuali owner demo) lalu mengisi workspace contoh. Backup dulu, lalu jalankan lewat image `migrate`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
  -e SEED_ALLOW_PRODUCTION=true \
  -e SEED_OWNER_EMAIL=owner@domain-anda.com \
  -e SEED_OWNER_PASSWORD='password-kuat-min-12-karakter' \
  migrate npx prisma db seed
```

Tanpa `SEED_ALLOW_PRODUCTION=true` dan `SEED_OWNER_PASSWORD` (≥ 12 karakter) seed menolak berjalan di produksi. Pengguna demo lain memakai password yang sama dengan owner.

**Rilis baru:** `git pull` → backup → `build` → `up -d` (perintah yang sama dengan langkah 2). **Rollback:** `git checkout <commit lama>` → `build` → `up -d`; migrasi hanya maju, untuk data rusak gunakan restore backup.

Masalah umum: HTTPS tidak terbit (DNS belum mengarah / port 80-443 tertutup); build kehabisan memori (tambahkan swap 2 GB); app langsung berhenti saat start (env kurang/salah — pesan ada di `docker compose logs app`).

## CI

`.github/workflows/ci.yml`: install → prisma generate → migrate → lint → typecheck → format:check → test → build; job terpisah untuk E2E Playwright dan build Docker.

## Logging & error

- Logger Pino (`src/lib/logger.ts`): JSON, field sensitif (password/token/apiKey/cookie) disamarkan; `requestLogger(req)` menambahkan `requestId`.
- Error API: gunakan `AppError` + `handleRouteError` (`src/lib/errors.ts`); error tak terduga dilaporkan lewat `reportError` (`src/lib/error-tracking.ts`, titik integrasi Sentry via `setErrorReporter`).
