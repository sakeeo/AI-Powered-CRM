# Plan 1.18 — Reports, export & Lost Reason categorizer

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | REP-01–10, AI-07; Sprint 7                  |
| Prioritas       | P1                                          |
| Bergantung pada | 1.17                                        |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Laporan inti dengan filter dan export, plus kategorisasi alasan Lost berbantuan AI.

## Tugas

- [x] Laporan: Lead, Pipeline, Won/Lost (P0); Conversion, Lead Source, Sales Performance, Activity, Revenue dari deal Won (P1).
- [x] Filter periode, user, tim; export laporan CSV/XLSX.
- [x] Safe AI Lost Reason Categorizer: usulkan kategori baku dari teks bebas; user mengonfirmasi/mengubah kategori — tidak otomatis final.
- [x] Pastikan label revenue jelas: nilai deal Won ≠ cash received/accounting revenue.
- [x] Test: konsistensi angka antar laporan dan dashboard.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Recharts`, `ExcelJS`, `Vercel AI SDK`.

## Acceptance Criteria

- [x] Semua laporan P0 tersedia dan dapat di-export.
- [x] Kategori Lost reason dapat dipakai pada laporan Won/Lost.

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

1. [ ] **Update progress** — ubah status plan 1.18 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(reports): plan 1.18 - Reports, export & Lost Reason categorizer" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
