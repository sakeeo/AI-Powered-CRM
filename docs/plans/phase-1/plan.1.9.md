# Plan 1.9 — Pipelines & Deal management

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | DEAL-01–06, DEAL-14, SET-05; Sprint 3       |
| Prioritas       | P0                                          |
| Bergantung pada | 1.5                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Pipeline configurable dan CRUD deal dengan owner, nilai, mata uang, dan closing date.

## Tugas

- [x] Model Pipeline, PipelineStage, Deal; seed pipeline default (New Opportunity → Negotiation) + outcome terminal Won/Lost.
- [x] Konfigurasi pipeline & stage di Settings (tambah/ubah/urut/arsip stage; probability per stage).
- [x] CRUD deal: contact/company, owner, nilai (`Decimal`) + currency, expected closing date, probability dasar.
- [x] Halaman Deal List (TanStack Table) dan detail deal; ringkasan nilai pipeline per stage.
- [x] Hubungkan deal ke related deals di halaman contact/company.
- [x] Test: CRUD, isolasi tenant, validasi nilai uang.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `TanStack Table`, `React Hook Form + Zod`.

## Acceptance Criteria

- [x] Pipeline dan stage dapat dikonfigurasi organisasi.
- [x] Deal dapat dibuat dan dikelola dengan nilai & mata uang benar.

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

1. [ ] **Update progress** — ubah status plan 1.9 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(deals): plan 1.9 - Pipelines & Deal management" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
