# Plan 1.12 — Calendar & AI notes assistant

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | ACT-07, AI-02–04; Sprint 4                  |
| Prioritas       | P0                                          |
| Bergantung pada | 1.11, 1.4                                   |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Kalender aktivitas dan asisten AI untuk catatan/follow-up dengan human-in-the-loop.

## Tugas

- [x] Tampilan kalender dasar aktivitas (FullCalendar) dengan filter user.
- [x] Safe AI Meeting & Call Summarizer: coretan → ringkasan terstruktur 2 paragraf (draf, bisa diedit).
- [x] Safe AI Action Item Extractor: deteksi komitmen tanggal → draf next activity yang harus dikonfirmasi user.
- [x] Safe AI Follow-up Ghostwriter: 3 opsi draf pesan (WA/Email) berdasar riwayat terakhir; tombol salin + shortcut wa.me click-to-chat; tidak ada auto-send.
- [x] Guardrail & test: tidak ada pengiriman/penyimpanan otomatis dari output AI.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `@fullcalendar/react`, `Vercel AI SDK`.

## Acceptance Criteria

- [x] Kalender menampilkan aktivitas sesuai filter.
- [x] Semua output AI berupa draf yang wajib disetujui user.

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

1. [ ] **Update progress** — ubah status plan 1.12 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(activities): plan 1.12 - Calendar & AI notes assistant" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
