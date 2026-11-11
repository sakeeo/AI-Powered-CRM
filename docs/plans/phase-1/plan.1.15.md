# Plan 1.15 — Quotation builder & PDF

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | QUO-01–07; Sprint 5                         |
| Prioritas       | P1                                          |
| Bergantung pada | 1.14, 1.9                                   |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Quotation dibuat dari deal dengan perhitungan deterministik dan PDF.

## Tugas

- [ ] Model Quotation + QuotationItem; status Draft/Sent/Accepted/Rejected/Expired; masa berlaku.
- [ ] Quotation builder: item dari katalog, quantity, diskon, pajak (konfigurasi jelas per organisasi).
- [ ] Fungsi perhitungan subtotal/diskon/pajak/total deterministik (`Decimal`, tanpa floating point) dengan unit test menyeluruh — tidak boleh melibatkan LLM.
- [ ] Generate PDF dengan `@react-pdf/renderer`; simpan ke object storage per tenant; unduh dari UI.
- [ ] Hubungkan quotation dengan deal dan customer; pengingat quotation mendekati expiry (membuat follow-up).
- [ ] Test: perhitungan (pembulatan, diskon, pajak), transisi status, PDF terbentuk.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `@react-pdf/renderer`, `decimal.js / Prisma Decimal`.

## Acceptance Criteria

- [ ] Total quotation akurat pada semua test case.
- [ ] PDF dapat dihasilkan dan diunduh.
- [ ] Disclaimer: bukan sistem perpajakan/akuntansi.

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

1. [ ] **Update progress** — ubah status plan 1.15 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(quotations): plan 1.15 - Quotation builder & PDF" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
