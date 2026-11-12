# Plan 3.3 — AI follow-up recommendation

| Item            | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Phase           | [Phase 3 — Intelligent CRM](../../phase/phase-3-intelligent-crm.md) |
| Referensi PRD   | §15                                                                 |
| Prioritas       | P2                                                                  |
| Bergantung pada | 3.1                                                                 |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                              |

## Tujuan

Rekomendasi follow-up berdasarkan pola interaksi historis.

## Tugas

- [x] Analisis pola interaksi.
- [x] Rekomendasi waktu/kanal/isi follow-up sebagai draf.
- [x] Umpan balik user (diterima/ditolak) untuk metrik AI Draft Acceptance Rate.

## Acceptance Criteria

- [x] Rekomendasi bersifat draf.
- [x] Metrik penerimaan terekam.

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

1. [ ] **Update progress** — ubah status plan 3.3 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(ai): plan 3.3 - AI follow-up recommendation" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
