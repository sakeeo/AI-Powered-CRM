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

- [x] Konfigurasi deployment production (Docker + VPS/managed cloud), secret management, migrasi otomatis. _(konfigurasi & runbook siap: `docker-compose.prod.yml`, `docs/deployment.md`; eksekusi di server nyata ⏳)_
- [x] Backup Postgres terjadwal terenkripsi + prosedur restore terdokumentasi dan **diuji (restore drill)**. _(drill berhasil 2026-11-12)_
- [x] Error monitoring dan logging terpusat; health check & alert dasar. _(health check, log JSON, titik integrasi Sentry, panduan alert — `docs/deployment.md`)_
- [ ] User acceptance testing dengan pengguna awal; catat dan selesaikan temuan. _⏳ butuh pengguna nyata — skenario & lembar temuan di `docs/uat.md`_
- [x] Dokumentasi pengguna dan teknis (runbook deploy, backup/restore, env).
- [x] Verifikasi seluruh checklist MVP Release Criteria (PRD §12) dan centang di Phase doc.
- [ ] Tag rilis `v1.0.0`. _⏳ diberikan setelah deployment production + UAT disetujui_

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Docker`, `pg_dump / pgBackRest`, `Sentry (opsional)`.

## Acceptance Criteria

- [ ] Aplikasi berjalan di production dengan HTTPS. _⏳ butuh server & domain_
- [x] Restore drill berhasil pada lingkungan terpisah.
- [x] Checklist PRD §12 seluruhnya terpenuhi.

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
