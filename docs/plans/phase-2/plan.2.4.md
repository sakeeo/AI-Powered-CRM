# Plan 2.4 — Calendar, email sync & Zapier/Make

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | §8.2, §15                                                     |
| Prioritas       | P2                                                            |
| Bergantung pada | 2.2                                                           |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Sinkronisasi kalender/email dan integrasi no-code.

## Tugas

- [ ] Google Calendar sync dua arah untuk activity.
- [ ] Email provider sync (read-only dulu) ke timeline.
- [ ] Outbound webhook & dukungan Zapier/Make sebagai provider Connector Hub.
- [ ] Test token refresh, rate limit, dan isolasi tenant.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Google APIs`, `Webhook`.

## Acceptance Criteria

- [ ] Aktivitas tersinkron ke kalender pengguna.
- [ ] Event bisnis dapat diteruskan ke Zapier/Make.

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

1. [ ] **Update progress** — ubah status plan 2.4 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(integrations): plan 2.4 - Calendar, email sync & Zapier/Make" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
