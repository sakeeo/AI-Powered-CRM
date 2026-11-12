# Plan 3.6 — Omnichannel communication hub

| Item            | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Phase           | [Phase 3 — Intelligent CRM](../../phase/phase-3-intelligent-crm.md) |
| Referensi PRD   | §15                                                                 |
| Prioritas       | P2                                                                  |
| Bergantung pada | 2.3                                                                 |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                              |

## Tujuan

Penyatuan kanal komunikasi dalam satu hub.

## Tugas

- [x] Tambah kanal (email, WA, lainnya) ke model percakapan.
- [x] Routing & assignment lintas kanal.
- [x] Timeline terpadu per customer.

## Acceptance Criteria

- [x] Percakapan multi-kanal terpadu per customer.

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

1. [ ] **Update progress** — ubah status plan 3.6 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(inbox): plan 3.6 - Omnichannel communication hub" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
