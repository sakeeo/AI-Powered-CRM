# Plan 2.3 — WhatsApp Business gateway & shared inbox

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | CONN-06 lanjutan; §8.2, §15                                   |
| Prioritas       | P1                                                            |
| Bergantung pada | 2.2                                                           |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Komunikasi WhatsApp terintegrasi di CRM dengan percakapan yang dapat ditugaskan.

## Tugas

- [ ] Connector WhatsApp Business via gateway pihak ketiga (BYOK/token per tenant).
- [ ] Webhook inbound pesan, model Conversation/Message, assignment percakapan.
- [ ] UI shared inbox terkait lead/contact; log ke timeline.
- [ ] Pengiriman pesan hanya atas aksi eksplisit user (tanpa auto-send AI).
- [ ] Test: signature webhook, isolasi tenant.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Gateway WA (mis. provider pilihan)`.

## Acceptance Criteria

- [ ] Pesan masuk tertaut ke record dan dapat ditugaskan.
- [ ] Pesan keluar hanya via aksi user.

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

1. [ ] **Update progress** — ubah status plan 2.3 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(inbox): plan 2.3 - WhatsApp Business gateway & shared inbox" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
