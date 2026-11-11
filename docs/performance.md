# Performa & Load Test

Target awal (plan 1.19): **P95 < 500 ms** untuk endpoint umum.

## Cara menjalankan

```bash
npm run build && npm run start -- -p 3300     # satu instance production
npm run test:e2e                              # sekali, membuat e2e/.auth/user.json (tidak di-commit)
npm run loadtest                              # BASE_URL, CONNECTIONS (default 4), DURATION (detik)
```

`scripts/load-test.mjs` memakai autocannon dengan cookie session E2E. autocannon melaporkan p90 dan p97,5; P95 berada di antaranya sehingga **p97,5 dipakai sebagai pembanding yang konservatif**. Skrip keluar dengan kode 1 bila ada endpoint melewati target atau error.

## Hasil terukur (2026-11-12, mesin dev 8 core yang juga menjalankan Postgres/Redis/MinIO + aplikasi lain, 1 proses Node)

Latensi layanan satu permintaan (1 koneksi): p97,5 antara **41 ms (`/products`) dan 119 ms (`/dashboard`)**; `/api/health` 11 ms.

Beban 4 koneksi paralel per instance (target terpenuhi, 0 error):

| Endpoint | req/s | p50 | p90 | p97,5 |
| --- | --- | --- | --- | --- |
| /api/health | 225 | 17 | 22 | 26 |
| /dashboard | 13 | 280 | 352 | 406 |
| /leads | 25 | 122 | 213 | 238 |
| /deals?view=board | 23 | 165 | 196 | 293 |
| /customers | 17 | 206 | 320 | 394 |
| /quotations | 13 | 261 | 389 | 492 |
| /reports | 17 | 218 | 327 | 381 |

## Kapasitas & batas yang jujur

- Halaman SSR bersifat CPU-bound: satu proses Node melayani sekitar **13–28 req/s** untuk halaman data. Pada 10 koneksi paralel per instance, antrean membuat P95 melewati 500 ms (1–1,9 s untuk dashboard) — **target 500 ms hanya berlaku sampai ±4 koneksi bersamaan per instance**.
- Skala ke atas dilakukan secara horizontal: jalankan beberapa instance di belakang reverse proxy (lihat `docs/deployment.md`), satu worker BullMQ terpisah. Untuk MVP (puluhan pengguna aktif bersamaan) 2 instance sudah cukup; ukur ulang dengan `npm run loadtest` di lingkungan production sebelum menaikkan target.
- Dashboard (~25 query agregasi) paling berat (~90 ms layanan). Optimasi lanjutan bila perlu: cache per-organisasi singkat (`'use cache'` + `cacheTag`) dan memindahkan seri harian ke agregasi SQL.

## Indeks yang mendukung query utama

Lihat daftar di `docs/metrics.md` (bagian Performa query) dan `prisma/schema.prisma` (`@@index`). Tidak ditemukan full scan pada query dashboard/laporan di data uji; tabel besar (lead, deal, aktivitas) semuanya berindeks pada `(organization_id, …)`.
