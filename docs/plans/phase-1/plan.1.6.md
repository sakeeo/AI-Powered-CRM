# Plan 1.6 — Lead management core

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | LEAD-01–06, LEAD-11, SET-06; Sprint 2       |
| Prioritas       | P0                                          |
| Bergantung pada | 1.5                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Lead dapat dikelola dari pencatatan hingga kualifikasi dan penugasan.

## Tugas

- [ ] Model Lead, LeadSource; status default New/Contacted/Qualified/Unqualified (konfigurasi terbatas).
- [ ] CRUD + arsip lead; field: nama, kontak, perusahaan, kebutuhan, budget, urgency, catatan.
- [ ] Konfigurasi Lead Source di Settings (SET-06).
- [ ] Assignment ke sales (owner); filter berdasarkan owner/status/source.
- [ ] Alur kualifikasi: ubah status + alasan Unqualified.
- [ ] Halaman list + detail lead, Quick Add via Sheet; dukung search/filter/sort/pagination.
- [ ] Test: CRUD, assignment, izin Sales Rep (hanya data yang dimiliki/diizinkan).

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `TanStack Table`, `React Hook Form + Zod`.

## Acceptance Criteria

- [ ] Lead dapat dibuat, ditugaskan, dikualifikasi, diarsipkan.
- [ ] Sales Rep hanya melihat lead sesuai izin.
- [ ] Sumber lead dapat dikonfigurasi.

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

1. [ ] **Update progress** — ubah status plan 1.6 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(leads): plan 1.6 - Lead management core" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
