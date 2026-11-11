# Plan 0.2 — Dev infrastructure (Redis, object storage)

| Item            | Detail                                                  |
| --------------- | ------------------------------------------------------- |
| Phase           | [Phase 0 — Project Setup](../../phase/phase-0-setup.md) |
| Referensi PRD   | §8.1, §10                                               |
| Prioritas       | P0                                                      |
| Bergantung pada | 0.1                                                     |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                  |

## Tujuan

Seluruh dependency lokal (Redis untuk queue, S3-compatible untuk file/PDF) tersedia lewat satu perintah.

## Tugas

- [ ] Tambahkan service Redis 7 ke `docker-compose.yml` (host port unik, volume, healthcheck).
- [ ] Tambahkan service MinIO (S3-compatible) + inisialisasi bucket `crm-files` otomatis.
- [ ] Tambahkan variabel `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` ke `.env.example` dan skema env Zod.
- [ ] Buat client singleton `src/lib/redis.ts` (ioredis) dan `src/lib/storage.ts` (`@aws-sdk/client-s3`) dengan prefix path per tenant.
- [ ] Tambahkan endpoint `GET /api/health` yang memeriksa Postgres, Redis, dan storage.
- [ ] Tambahkan script `npm run infra:up|down|reset`.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `ioredis`, `@aws-sdk/client-s3`, `MinIO`.

## Acceptance Criteria

- [ ] `docker compose up -d` → semua service healthy.
- [ ] `/api/health` mengembalikan status ketiga dependency.
- [ ] Upload & download file uji ke bucket berhasil lewat helper storage.

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

1. [ ] **Update progress** — ubah status plan 0.2 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "chore(infra): plan 0.2 - Dev infrastructure (Redis, object storage)" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
