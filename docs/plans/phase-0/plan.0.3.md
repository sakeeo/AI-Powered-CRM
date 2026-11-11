# Plan 0.3 — Database foundation

| Item            | Detail                                                  |
| --------------- | ------------------------------------------------------- |
| Phase           | [Phase 0 — Project Setup](../../phase/phase-0-setup.md) |
| Referensi PRD   | §7.3, §7.4                                              |
| Prioritas       | P0                                                      |
| Bergantung pada | 0.1                                                     |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                  |

## Tujuan

Konvensi schema dan alur migrasi/seed ditetapkan sehingga semua entitas Phase 1 mengikuti pola yang sama.

## Tugas

- [ ] Tetapkan konvensi: `id` UUID, `organization_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`; uang `Decimal` + kode ISO 4217; timestamp UTC.
- [ ] Perbarui model `Organization` mengikuti konvensi (UUID, soft delete bila perlu).
- [ ] Buat helper tenant-scoped Prisma (client extension) yang otomatis menyisipkan `organization_id` pada query/create — skeleton, diuji penuh di plan 1.3.
- [ ] Buat seed (`prisma/seed.ts`): organisasi demo dan data dasar; script `db:migrate`, `db:seed`, `db:reset`, `db:studio`.
- [ ] Siapkan database test terpisah (`crm_test`) dan helper reset untuk integration test.
- [ ] Dokumentasikan alur migrasi (dev vs production) di `docs/database.md`.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Prisma`, `@prisma/adapter-pg`.

## Acceptance Criteria

- [ ] Migrasi dan seed berjalan dari database kosong.
- [ ] Unit test membuktikan helper tenant scope menyisipkan `organization_id`.
- [ ] Konvensi schema terdokumentasi.

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

1. [ ] **Update progress** — ubah status plan 0.3 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "chore(db): plan 0.3 - Database foundation" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
