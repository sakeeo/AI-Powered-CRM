# Plan 2.2 — Workflow automation engine

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | §8.3; §15                                                     |
| Prioritas       | P1                                                            |
| Bergantung pada | 2.1                                                           |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Automation event→rule yang aman: ada log, batas permission, dan pencegahan eksekusi ganda.

## Tugas

- [ ] Model Rule/Trigger/Action + log eksekusi.
- [ ] Trigger: lead dibuat, deal Won, task due, quotation mendekati expiry.
- [ ] Aksi: assign owner, buat task, kirim notifikasi (tanpa aksi AI otonom).
- [ ] Idempotency & batas laju eksekusi; UI konfigurasi & log.
- [ ] Test: tidak ada eksekusi berulang tak disengaja.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `BullMQ`.

## Acceptance Criteria

- [ ] Rule dapat dibuat, dinonaktifkan, dan dilacak lognya.
- [ ] Eksekusi ganda dicegah.

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

1. [ ] **Update progress** — ubah status plan 2.2 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(automation): plan 2.2 - Workflow automation engine" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
