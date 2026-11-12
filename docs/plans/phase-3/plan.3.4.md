# Plan 3.4 — Automated customer insights & anomaly detection

| Item            | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Phase           | [Phase 3 — Intelligent CRM](../../phase/phase-3-intelligent-crm.md) |
| Referensi PRD   | §15                                                                 |
| Prioritas       | P2                                                                  |
| Bergantung pada | Phase 2                                                             |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                              |

## Tujuan

Deteksi penurunan aktivitas pelanggan penting dan insight otomatis.

## Tugas

- [x] Definisi anomali (mis. penurunan aktivitas pelanggan VIP).
- [x] Job terjadwal + notifikasi in-app.
- [x] Dashboard insight; tanpa tindakan otomatis.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `BullMQ`.

## Acceptance Criteria

- [x] Anomali terdeteksi dan dinotifikasikan.
- [x] Tidak ada aksi otonom.

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

1. [ ] **Update progress** — ubah status plan 3.4 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(ai): plan 3.4 - Automated customer insights & anomaly detection" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
