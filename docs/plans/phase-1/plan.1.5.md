# Plan 1.5 — Contacts & Companies

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | CONT-01–05, CONT-08–10, CONT-12; Sprint 2   |
| Prioritas       | P0                                          |
| Bergantung pada | 1.3                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

CRUD contact dan company dengan relasi eksplisit, pencarian, dan data table standar.

## Tugas

- [ ] Model Company, Contact, ContactCompany (relasi eksplisit many-to-many).
- [ ] Skema Zod bersama untuk validasi client + server; Route Handlers/Server Actions dengan tenant scope & CASL.
- [ ] Halaman list (TanStack Table: sorting, filter, pagination server-side) dan detail untuk Contact & Company.
- [ ] Slide-over Sheet untuk Quick Add dan preview.
- [ ] Menampilkan related deals (placeholder sampai plan 1.9) dan catatan internal.
- [ ] Komponen reusable `DataTable` dan `EntitySheet` untuk dipakai modul lain.
- [ ] Empty state yang mengarahkan aksi (Import CSV / Tambah).

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `TanStack Table`, `React Hook Form + Zod`, `shadcn/ui Sheet`.

## Acceptance Criteria

- [ ] CRUD contact & company berfungsi dengan relasi.
- [ ] Pencarian, filter, sort, pagination bekerja di server.
- [ ] Test CRUD + isolasi tenant lulus.

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

1. [ ] **Update progress** — ubah status plan 1.5 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(contacts): plan 1.5 - Contacts & Companies" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
