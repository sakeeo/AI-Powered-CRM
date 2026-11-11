# Plan 0.5 — Testing, logging & CI

| Item            | Detail                                                  |
| --------------- | ------------------------------------------------------- |
| Phase           | [Phase 0 — Project Setup](../../phase/phase-0-setup.md) |
| Referensi PRD   | §9, §11 Sprint 8                                        |
| Prioritas       | P0                                                      |
| Bergantung pada | 0.1, 0.3                                                |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                  |

## Tujuan

Kualitas otomatis berjalan sejak awal: unit/integration/E2E test, logging terstruktur, container image, dan CI.

## Tugas

- [ ] Pasang Vitest (unit + integration) dan Testing Library; contoh test untuk helper env dan tenant scope.
- [ ] Pasang Playwright untuk E2E; satu smoke test (halaman utama termuat).
- [ ] Pasang Pino (`src/lib/logger.ts`) dengan request id dan redaksi field sensitif (password, token, API key).
- [ ] Siapkan penanganan error terpusat dan titik integrasi error tracking (mis. Sentry) — dapat dinonaktifkan via env.
- [ ] Buat `Dockerfile` multi-stage production untuk aplikasi Next.js (standalone output).
- [ ] Buat workflow GitHub Actions: install → lint → typecheck → test (service Postgres/Redis) → build.
- [ ] Opsional: husky + lint-staged untuk pre-commit.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Vitest`, `Playwright`, `Pino`, `GitHub Actions`.

## Acceptance Criteria

- [ ] CI hijau pada branch utama.
- [ ] `docker build` menghasilkan image yang dapat dijalankan.
- [ ] Log berformat JSON dan tidak membocorkan secret.

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

1. [ ] **Update progress** — ubah status plan 0.5 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "chore(ci): plan 0.5 - Testing, logging & CI" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
