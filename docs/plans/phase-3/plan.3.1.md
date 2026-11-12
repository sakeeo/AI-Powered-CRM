# Plan 3.1 — AI lead scoring

| Item            | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Phase           | [Phase 3 — Intelligent CRM](../../phase/phase-3-intelligent-crm.md) |
| Referensi PRD   | §15                                                                 |
| Prioritas       | P2                                                                  |
| Bergantung pada | Phase 2                                                             |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                              |

## Tujuan

Skor lead berbasis riwayat aktivitas, read-only.

## Tugas

- [x] Definisi fitur & evaluasi kualitas data.
- [x] Pipeline skoring (read-only, transparan: tampilkan faktor).
- [x] Badge skor di list/detail lead.
- [x] Test: skor tidak mengubah status/assignment.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Vercel AI SDK`.

## Acceptance Criteria

- [x] Skor informatif dan dapat dijelaskan.
- [x] Tidak ada perubahan data otomatis.

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

1. [ ] **Update progress** — ubah status plan 3.1 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(ai): plan 3.1 - AI lead scoring" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
