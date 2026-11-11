# Plan 1.17 — Dashboard

| Item            | Detail                                          |
| --------------- | ----------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md)     |
| Referensi PRD   | DASH-01–05, DASH-10 (+P1: DASH-06–09); Sprint 7 |
| Prioritas       | P1                                              |
| Bergantung pada | 1.10, 1.11, 1.15                                |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)          |

## Tujuan

Dashboard menampilkan KPI aktual dan panel Action Required.

## Tugas

- [ ] Kartu KPI: total lead, deal aktif, customer, nilai deal (DASH-01); lead baru per periode (DASH-02); ringkasan pipeline (DASH-03).
- [ ] Aktivitas mendatang & terlambat (DASH-04, 05); aktivitas terbaru (DASH-06).
- [ ] Panel Action Required: lead baru belum ditindaklanjuti, follow-up terlambat, deal aktif tanpa next activity, quotation perlu tindak lanjut.
- [ ] Performa sales dan lead source; filter periode/tim/pengguna (DASH-07–09).
- [ ] Grafik dengan shadcn/ui Charts (Recharts); query teragregasi dengan index yang tepat.
- [ ] Dokumentasikan definisi tiap metrik (periode, cohort, denominator) di `docs/metrics.md`.
- [ ] Test: angka dashboard cocok dengan data seed.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `shadcn/ui Charts (Recharts)`.

## Acceptance Criteria

- [ ] Dashboard memakai data aktual dan menghormati permission.
- [ ] Definisi metrik terdokumentasi dan konsisten.

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

1. [ ] **Update progress** — ubah status plan 1.17 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(dashboard): plan 1.17 - Dashboard" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
