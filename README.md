# CRM

CRM berbasis cloud (multi-tenant, SaaS-ready) untuk Lead Acquisition, Sales Conversion, dan Customer Retention. Lihat [docs/PRD.md](docs/PRD.md).

## Dokumen proyek

- [docs/PRD.md](docs/PRD.md) — Product Requirements Document
- [docs/phase/](docs/phase) — pembagian phase pengembangan
- [docs/plans/](docs/plans) — plan kerja per phase (`plan.<phase>.<nomor>.md`)
- [docs/PROGRESS.md](docs/PROGRESS.md) — status pengerjaan plan
- [docs/decisions.md](docs/decisions.md) — keputusan produk & teknis
- [docs/database.md](docs/database.md) — konvensi database, tenant scope, migrasi
- [docs/design-system.md](docs/design-system.md) — **satu-satunya** referensi desain UI/UX (bersumber dari [mockup](docs/mockup-dasboard.html))

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

## CI

`.github/workflows/ci.yml`: install → prisma generate → migrate → lint → typecheck → format:check → test → build; job terpisah untuk E2E Playwright dan build Docker.

## Logging & error

- Logger Pino (`src/lib/logger.ts`): JSON, field sensitif (password/token/apiKey/cookie) disamarkan; `requestLogger(req)` menambahkan `requestId`.
- Error API: gunakan `AppError` + `handleRouteError` (`src/lib/errors.ts`); error tak terduga dilaporkan lewat `reportError` (`src/lib/error-tracking.ts`, titik integrasi Sentry via `setErrorReporter`).
