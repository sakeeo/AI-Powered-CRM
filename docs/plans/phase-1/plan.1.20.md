# Plan 1.20 — Release: backup/restore, monitoring, deployment & docs

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | §9.2, §11 Sprint 8, §12                     |
| Prioritas       | P0                                          |
| Bergantung pada | 1.19                                        |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

MVP terdeploy di production dengan backup teruji, monitoring, dan dokumentasi.

## Tugas

- [ ] Konfigurasi deployment production (Docker + VPS/managed cloud), secret management, migrasi otomatis.
- [ ] Backup Postgres terjadwal terenkripsi + prosedur restore terdokumentasi dan **diuji (restore drill)**.
- [ ] Error monitoring dan logging terpusat; health check & alert dasar.
- [ ] User acceptance testing dengan pengguna awal; catat dan selesaikan temuan.
- [ ] Dokumentasi pengguna dan teknis (runbook deploy, backup/restore, env).
- [ ] Verifikasi seluruh checklist MVP Release Criteria (PRD §12) dan centang di Phase doc.
- [ ] Tag rilis `v1.0.0`.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Docker`, `pg_dump / pgBackRest`, `Sentry (opsional)`.

## Acceptance Criteria

- [ ] Aplikasi berjalan di production dengan HTTPS.
- [ ] Restore drill berhasil pada lingkungan terpisah.
- [ ] Checklist PRD §12 seluruhnya terpenuhi.

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

1. [ ] **Update progress** — ubah status plan 1.20 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(release): plan 1.20 - Release: backup/restore, monitoring, deployment & docs" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
