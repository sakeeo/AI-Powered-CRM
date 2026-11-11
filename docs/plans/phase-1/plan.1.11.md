# Plan 1.11 — Activities, tasks & timeline

| Item            | Detail                                       |
| --------------- | -------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md)  |
| Referensi PRD   | ACT-01–06, ACT-08, ACT-10, CONT-09; Sprint 4 |
| Prioritas       | P0                                           |
| Bergantung pada | 1.6, 1.9                                     |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)       |

## Tujuan

Task dan aktivitas (call, meeting, email, note) terhubung ke lead/contact/company/deal dengan timeline terpadu.

## Tugas

- [x] Model Activity (tipe: task/call/meeting/email/note; status; due date; assignee; relasi polymorphic eksplisit).
- [x] CRUD task dengan assignee dan due date; tandai selesai/dibatalkan; jadwalkan follow-up.
- [x] Quick composer untuk log call/note/meeting; catatan memakai Tiptap.
- [x] Activity timeline terpadu pada detail lead, contact, company, deal.
- [x] Daftar Upcoming dan Overdue activity (halaman Activities & Tasks).
- [x] Test: relasi polymorphic, izin, timeline urut kronologis.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Tiptap`, `date-fns`.

## Acceptance Criteria

- [x] Aktivitas tercatat dan tampil di timeline record terkait.
- [x] Upcoming/Overdue akurat terhadap timezone organisasi.

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

1. [ ] **Update progress** — ubah status plan 1.11 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(activities): plan 1.11 - Activities, tasks & timeline" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
