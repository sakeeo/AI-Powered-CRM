# Plan 3.7 — Outbound webhooks for ERP/POS/Accounting

| Item            | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Phase           | [Phase 3 — Intelligent CRM](../../phase/phase-3-intelligent-crm.md) |
| Referensi PRD   | §15, §8.2                                                           |
| Prioritas       | P2                                                                  |
| Bergantung pada | 2.4                                                                 |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                              |

## Tujuan

Event bisnis diteruskan ke sistem eksternal secara andal.

## Tugas

- [ ] Katalog event bisnis & skema payload versi.
- [ ] Pengiriman webhook dengan signature, retry, dead-letter log.
- [ ] UI manajemen endpoint per tenant.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `BullMQ`.

## Acceptance Criteria

- [ ] Event terkirim dengan retry dan dapat diaudit.

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

1. [ ] **Update progress** — ubah status plan 3.7 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(integrations): plan 3.7 - Outbound webhooks for ERP/POS/Accounting" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
