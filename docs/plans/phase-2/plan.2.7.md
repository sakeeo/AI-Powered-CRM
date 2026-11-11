# Plan 2.7 — Quotation versioning, approval & repeat purchase

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | QUO-08, ACT-11, RET-08                                        |
| Prioritas       | P2                                                            |
| Bergantung pada | Phase 1                                                       |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Pelengkap P2 pada quotation, aktivitas, dan retensi.

## Tugas

- [ ] Versi & riwayat perubahan quotation; opsional alur approval (sesuai keputusan #7).
- [ ] Template aktivitas.
- [ ] Identifikasi peluang repeat purchase.
- [ ] Test versioning dan riwayat.

## Acceptance Criteria

- [ ] Versi quotation dapat dibandingkan.
- [ ] Template aktivitas dapat dipakai ulang.

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

1. [ ] **Update progress** — ubah status plan 2.7 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(quotations): plan 2.7 - Quotation versioning, approval & repeat purchase" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
