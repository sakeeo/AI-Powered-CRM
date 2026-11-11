# Plan 1.13 — Notifications, email delivery & reminder jobs

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | ACT-09, CONN-06, SET-09; Sprint 4           |
| Prioritas       | P0                                          |
| Bergantung pada | 1.11, 0.2                                   |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Reminder berjalan di background, notifikasi in-app tampil, dan email delivery dapat dikonfigurasi mandiri.

## Tugas

- [ ] Pasang BullMQ worker (proses terpisah) dengan retry exponential backoff dan logging.
- [ ] Model Notification + UI bell/inbox in-app, tandai dibaca; preferensi notifikasi dasar.
- [ ] Job reminder task mendekati/lewat due date; pencegahan reminder ganda (idempotency key).
- [ ] Connector Email Delivery (Resend SDK atau SMTP kustom) di Connector Hub + Test Connection.
- [ ] Gunakan connector email untuk undangan pengguna dan reset password (menggantikan stub di 1.1/1.2).
- [ ] Test: job retry, tidak duplikat, email terkirim via mock.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `BullMQ`, `ioredis`, `Resend / Nodemailer`, `Sonner`.

## Acceptance Criteria

- [ ] Reminder terkirim tepat waktu sekali saja.
- [ ] Email delivery dapat dikonfigurasi dan diuji oleh Owner/Admin.

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

1. [ ] **Update progress** — ubah status plan 1.13 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(notifications): plan 1.13 - Notifications, email delivery & reminder jobs" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
