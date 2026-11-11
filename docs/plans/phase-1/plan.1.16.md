# Plan 1.16 — Customer retention & Customer 360

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | RET-01–07, AI-05; Sprint 6                  |
| Prioritas       | P1                                          |
| Bergantung pada | 1.10, 1.11                                  |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Customer diturunkan dari deal Won dengan riwayat lengkap, segmentasi, dan tindak lanjut pasca-penjualan.

## Tugas

- [ ] Definisikan customer = contact/company dengan ≥1 deal Won (turunan dari data transaksi, bukan input manual); catat aturan di `docs/decisions.md`.
- [ ] Halaman Customers + Customer 360 profile: deal/pembelian, aktivitas, quotation, feedback.
- [ ] Customer segmentation dasar (tags/segments sederhana).
- [ ] Post-sales follow-up dan renewal reminder (membuat task terjadwal).
- [ ] Pencatatan feedback & complaint.
- [ ] Safe AI Customer 360 Briefing: cheat-sheet 3 butir (total belanja, isu terakhir, peluang repeat/renewal); total belanja dihitung kode, bukan LLM.
- [ ] Test: status customer berubah saat deal Won; briefing tidak mengubah data.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Vercel AI SDK`, `TanStack Table`.

## Acceptance Criteria

- [ ] Deal Won otomatis memunculkan customer tanpa input ulang.
- [ ] Customer 360 menampilkan riwayat lengkap.

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

1. [ ] **Update progress** — ubah status plan 1.16 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(customers): plan 1.16 - Customer retention & Customer 360" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
