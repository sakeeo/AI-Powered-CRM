# Plan 1.14 — Product & service catalog

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | PROD-01–05; Sprint 5                        |
| Prioritas       | P1                                          |
| Bergantung pada | 1.5                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Katalog produk/layanan dasar untuk digunakan di deal dan quotation.

## Tugas

- [x] Model Product (nama, deskripsi, SKU opsional, kategori, harga `Decimal`, currency, aktif/nonaktif) dan kategori.
- [x] CRUD + aktif/nonaktif; list dengan data table dan pencarian.
- [x] Hubungkan produk dengan deal (DEAL-13) sebagai item referensi.
- [x] Test: validasi harga, isolasi tenant.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `TanStack Table`, `React Hook Form + Zod`.

## Acceptance Criteria

- [x] Produk dapat dikelola dan dipilih pada deal.
- [x] Tidak ada fitur stok/inventory (di luar scope).

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Jalankan juga verifikasi manual/E2E yang relevan dengan acceptance criteria di atas.

## Penutup Plan (WAJIB)

Plan dianggap selesai hanya setelah kedua langkah ini dilakukan, berurutan:

1. [ ] **Update progress** — ubah status plan 1.14 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(catalog): plan 1.14 - Product & service catalog" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
