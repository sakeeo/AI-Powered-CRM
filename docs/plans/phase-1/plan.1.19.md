# Plan 1.19 — QA, security & performance hardening

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | §9, §11 Sprint 8                            |
| Prioritas       | P0                                          |
| Bergantung pada | 1.1–1.18                                    |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Kualitas, keamanan, dan performa diverifikasi sebelum rilis.

## Tugas

- [ ] Functional test: E2E Playwright untuk alur Lead→Deal→Activity→Quotation→Customer.
- [ ] Tenant isolation & permission test menyeluruh untuk seluruh entitas dan endpoint.
- [ ] AI Red Zone enforcement test: tidak ada auto-send, auto-calculate, auto-mutate, auto-merge/delete.
- [ ] Test enkripsi Connector Hub: key tidak bocor di response/log/audit.
- [ ] Validasi API (Zod), rate limiting, review OWASP/IDOR; audit dependency (`npm audit`).
- [ ] Load test (target awal P95 < 500 ms endpoint umum) dan optimasi index/query.
- [ ] Responsive UI test di desktop, tablet, smartphone.
- [ ] Perbaiki seluruh bug kritis yang ditemukan.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Playwright`, `k6 / autocannon`.

## Acceptance Criteria

- [ ] Seluruh test otomatis hijau.
- [ ] Tidak ada temuan keamanan severity tinggi yang terbuka.
- [ ] Target performa tercapai pada beban uji.

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

1. [ ] **Update progress** — ubah status plan 1.19 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(qa): plan 1.19 - QA, security & performance hardening" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
