# Plan 0.1 — Repository & tooling baseline

| Item            | Detail                                                  |
| --------------- | ------------------------------------------------------- |
| Phase           | [Phase 0 — Project Setup](../../phase/phase-0-setup.md) |
| Referensi PRD   | §10.1, §10.2                                            |
| Prioritas       | P0                                                      |
| Bergantung pada | —                                                       |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                  |

> **Catatan:** Scaffold, Postgres Docker, dan Prisma sudah dikerjakan; sisa: struktur folder, tooling, env validation, decisions, commit.

## Tujuan

Repo siap dikembangkan: struktur folder modular monolith, linting/formatting, validasi env, dan commit pertama.

## Tugas

- [x] Scaffold Next.js (App Router, TypeScript, Tailwind) di root project.
- [x] Docker Compose PostgreSQL 16 (container `crm-postgres`, host port 5434) + `.env` / `.env.example`.
- [x] Prisma 7 terpasang (`prisma.config.ts`, `schema.prisma`, client di `src/lib/prisma.ts`) + migrasi `init`.
- [x] Tetapkan struktur folder modular monolith: `src/modules/<modul>/{components,server,schemas,types}`, `src/lib`, `src/app`.
- [x] Pasang Prettier + `eslint-config-prettier`; tambahkan script `format`, `typecheck`, `lint`.
- [x] Validasi environment dengan Zod (`src/lib/env.ts`), gagal cepat bila variabel wajib hilang.
- [x] Tambahkan `docs/decisions.md` berisi Product Decisions §14.1 beserta default yang diusulkan (lihat Phase doc) untuk dikonfirmasi pemilik produk.
- [x] Rapikan `README.md` (cara menjalankan, struktur folder, daftar script).
- [x] Verifikasi `.gitignore` (env, `src/generated`, `graphify-out` bila perlu) lalu buat commit awal repository.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Prettier`, `Zod`.

## Acceptance Criteria

- [x] Struktur folder terdokumentasi di README.
- [x] Aplikasi gagal start dengan pesan jelas bila env wajib kosong.
- [x] `npm run lint && npm run typecheck && npm run build` lulus.
- [x] Git history memiliki commit awal yang bersih (tanpa secret).

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Jalankan juga verifikasi manual/E2E yang relevan dengan acceptance criteria di atas. Pada Phase 0, script `typecheck` baru tersedia setelah plan 0.1 dan `test` setelah plan 0.5; lewati yang belum ada.

## Penutup Plan (WAJIB)

Plan dianggap selesai hanya setelah kedua langkah ini dilakukan, berurutan:

1. [x] **Update progress** — ubah status plan 0.1 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [x] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "chore(setup): plan 0.1 - Repository & tooling baseline" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
