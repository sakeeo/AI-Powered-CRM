# Phase 0 — Project Setup

**Referensi PRD:** PRD §9, §10, §11 (bagian setup dari Sprint 1)

## Tujuan

Menyiapkan fondasi teknis project (repo, tooling, infrastruktur dev, database, UI shell, CI) sehingga Phase 1 bisa langsung mengerjakan fitur bisnis tanpa pekerjaan setup tersisa.

## Lingkup

- Struktur repository modular monolith, tooling kualitas kode, dan validasi environment.
- Infrastruktur development via Docker Compose (PostgreSQL, Redis, S3-compatible storage).
- Fondasi database: konvensi schema, migrasi, seed, helper tenant scope.
- Fondasi UI: shadcn/ui, theming dark/light, app shell dengan sidebar.
- Testing, logging, dan CI minimal.

## Di Luar Lingkup

- Fitur bisnis apa pun (auth, lead, deal, dll.) — mulai Phase 1.
- Deployment production — dikerjakan di plan 1.20.

## Daftar Plan

| Plan                                | Judul                                      | Prioritas | Bergantung pada |
| ----------------------------------- | ------------------------------------------ | --------- | --------------- |
| [0.1](../plans/phase-0/plan.0.1.md) | Repository & tooling baseline              | P0        | —               |
| [0.2](../plans/phase-0/plan.0.2.md) | Dev infrastructure (Redis, object storage) | P0        | 0.1             |
| [0.3](../plans/phase-0/plan.0.3.md) | Database foundation                        | P0        | 0.1             |
| [0.4](../plans/phase-0/plan.0.4.md) | UI foundation & app shell                  | P0        | 0.1             |
| [0.5](../plans/phase-0/plan.0.5.md) | Testing, logging & CI                      | P0        | 0.1, 0.3        |

## Kriteria Selesai Phase (Exit Criteria)

- [x] `docker compose up -d` menyalakan seluruh dependency lokal dalam keadaan healthy.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` lulus.
- [x] Migrasi + seed Prisma berjalan dari database kosong.
- [x] App shell (sidebar, theme toggle, halaman placeholder) tampil di browser.
- [x] CI menjalankan lint + typecheck + test + build pada setiap push.
- [x] Semua plan Phase 0 berstatus Done di `docs/PROGRESS.md` dan sudah di-commit.

## Product Decisions yang Diusulkan (PRD §14.1)

Default berikut adalah **usulan** yang fleksibel; dikonfirmasi pemilik produk dan dicatat di `docs/decisions.md` pada plan 0.1.

| #   | Pertanyaan                           | Default yang diusulkan                                                                                   |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1   | Satu akun di beberapa organisasi?    | Ya (plugin Organization Better Auth mendukungnya).                                                       |
| 2   | Satu contact ke beberapa company?    | Ya, relasi eksplisit `contact_company`.                                                                  |
| 3   | Deal dengan lebih dari satu contact? | MVP: 1 contact utama + company; tabel relasi ditambah bila dibutuhkan.                                   |
| 4   | Aturan merge duplikat?               | MVP: hanya deteksi + merge manual oleh user; tanpa auto-merge.                                           |
| 5   | Beberapa pipeline per organisasi?    | Schema mendukung banyak pipeline; UI MVP cukup satu default (DEAL-08 P1).                                |
| 6   | Definisi customer aktif/repeat?      | Customer = ≥1 deal Won; aktif/repeat didefinisikan di plan 1.16.                                         |
| 7   | Quotation perlu approval?            | Tidak di MVP (P2, plan 2.7).                                                                             |
| 8   | Retensi & penghapusan data?          | Soft delete (`deleted_at`) di MVP; kebijakan retensi final sebelum plan 1.20.                            |
| 9   | Default provider AI?                 | Gemini sebagai rekomendasi awal; semua provider tetap BYOK.                                              |
| 10  | Simpan log prompt/response AI?       | Default: tidak menyimpan isi; hanya metadata (fitur, waktu, status) sampai kebijakan privasi diputuskan. |
