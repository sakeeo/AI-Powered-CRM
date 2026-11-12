# Plan 2.6 — Advanced reporting & customer segmentation

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | §15                                                           |
| Prioritas       | P1                                                            |
| Bergantung pada | 2.1                                                           |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Pelaporan lebih dalam dan segmentasi pelanggan lanjutan.

## Tugas

- [x] Report builder dasar dan saved reports.
- [x] Segmentasi dinamis berbasis rule (tag, nilai, recency).
- [x] Jadwal pengiriman laporan via email.
- [x] Test akurasi metrik.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Recharts`, `ExcelJS`.

## Acceptance Criteria

- [x] Segmen dinamis dapat dipakai di filter dan laporan.
- [x] Laporan terjadwal terkirim.

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

1. [ ] **Update progress** — ubah status plan 2.6 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(reports): plan 2.6 - Advanced reporting & customer segmentation" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
