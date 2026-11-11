# Plan 1.10 — Kanban board, Won/Lost & Deal Risk advisor

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | DEAL-07, DEAL-10–12, AI-06; Sprint 3        |
| Prioritas       | P0                                          |
| Bergantung pada | 1.9                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Pipeline dapat dipantau dan digerakkan lewat Kanban; hasil deal dicatat; riwayat stage tersimpan.

## Tugas

- [ ] Kanban board dengan drag-and-drop antar stage (`@hello-pangea/dnd`), akses keyboard, update optimistik + rollback.
- [ ] Model DealStageHistory; catat setiap perubahan stage (siapa, kapan, dari→ke).
- [ ] Aksi Won/Lost; Lost wajib mencatat alasan (teks bebas + kategori, kategori otomatis di plan 1.18).
- [ ] Ringkasan nilai per kolom dan filter board (owner, periode).
- [ ] Safe AI Deal Risk badge pasif pada kartu: deal mandek tanpa interaksi mendekati closing date — hanya peringatan, tidak memindahkan stage.
- [ ] Peringatan (non-blocking) bila deal aktif tanpa next activity.
- [ ] Test: pindah stage mencatat history; AI tidak pernah mengubah stage.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `@hello-pangea/dnd`, `Vercel AI SDK (opsional)`.

## Acceptance Criteria

- [ ] Drag-and-drop memperbarui stage dan history.
- [ ] Won/Lost mensyaratkan alasan Lost.
- [ ] Badge risiko hanya informatif.

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

1. [ ] **Update progress** — ubah status plan 1.10 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(deals): plan 1.10 - Kanban board, Won/Lost & Deal Risk advisor" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
