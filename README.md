# CRM

CRM berbasis cloud (multi-tenant, SaaS-ready) untuk Lead Acquisition, Sales Conversion, dan Customer Retention. Lihat [docs/PRD.md](docs/PRD.md).

## Dokumen proyek

- [docs/PRD.md](docs/PRD.md) — Product Requirements Document
- [docs/phase/](docs/phase) — pembagian phase pengembangan
- [docs/plans/](docs/plans) — plan kerja per phase (`plan.<phase>.<nomor>.md`)
- [docs/PROGRESS.md](docs/PROGRESS.md) — status pengerjaan plan
- [docs/decisions.md](docs/decisions.md) — keputusan produk & teknis

## Prasyarat

Node.js 22+, npm, Docker (Compose).

## Menjalankan

```bash
cp .env.example .env        # lalu sesuaikan nilainya
docker compose up -d        # PostgreSQL di localhost:5434
npm ci
npx prisma migrate dev      # terapkan migrasi
npm run dev                 # http://localhost:3000
```

## Script

| Script                 | Fungsi                                |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Development server                    |
| `npm run build`        | Build production                      |
| `npm run lint`         | ESLint                                |
| `npm run typecheck`    | Generate route types + `tsc --noEmit` |
| `npm run format`       | Prettier (tulis)                      |
| `npm run format:check` | Prettier (cek saja)                   |

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
