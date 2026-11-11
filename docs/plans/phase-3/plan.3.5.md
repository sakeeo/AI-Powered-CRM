# Plan 3.5 — Probabilistic sales forecasting

| Item            | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Phase           | [Phase 3 — Intelligent CRM](../../phase/phase-3-intelligent-crm.md) |
| Referensi PRD   | §15                                                                 |
| Prioritas       | P2                                                                  |
| Bergantung pada | 3.2                                                                 |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                              |

## Tujuan

Forecast penjualan probabilistik berbasis data historis.

## Tugas

- [ ] Metodologi forecast & validasi backtest.
- [ ] Visualisasi rentang (P10/P50/P90).
- [ ] Label jelas: estimasi, bukan jaminan/akuntansi.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Recharts`.

## Acceptance Criteria

- [ ] Forecast dapat di-backtest.
- [ ] Asumsi dan batasan terdokumentasi.

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

1. [ ] **Update progress** — ubah status plan 3.5 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(reports): plan 3.5 - Probabilistic sales forecasting" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
