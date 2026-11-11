# Plan 1.8 — Import/export, inbound webhook & AI Text-to-Lead

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | LEAD-10, LEAD-13, CONN-05, AI-01; Sprint 2  |
| Prioritas       | P0                                          |
| Bergantung pada | 1.6, 1.4                                    |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Data masuk massal dan otomatis: CSV/XLSX, webhook form website, dan ekstraksi lead berbantuan AI.

## Tugas

- [ ] Import CSV (PapaParse) dengan mapping kolom, validasi per baris, laporan error, dan job background untuk berkas besar.
- [ ] Export CSV/XLSX (ExcelJS) untuk lead, contact, company dengan filter aktif dan cek permission export.
- [ ] Inbound Webhook generator per tenant: URL + secret/signature, validasi payload Zod, rate limit, pembuatan lead sumber 'Website'.
- [ ] UI webhook di Connector Hub (rotate secret, lihat log penerimaan).
- [ ] Safe AI Text-to-Lead: tempel teks WA/email → draf field lead terstruktur (Zod structured output) → ditampilkan untuk direview; tidak disimpan otomatis.
- [ ] Guardrail AI: output hanya draf, wajib klik Simpan oleh user.
- [ ] Test: import baris valid/invalid, webhook sah/tidak sah, AI draft tidak menulis ke DB.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `PapaParse`, `ExcelJS`, `Vercel AI SDK`, `BullMQ (job besar, aktif penuh di 1.13)`.

## Acceptance Criteria

- [ ] Import 1.000+ baris tanpa memblokir UI.
- [ ] Webhook menolak signature salah dan membuat lead untuk payload sah.
- [ ] Text-to-Lead hanya menghasilkan draf.

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

1. [ ] **Update progress** — ubah status plan 1.8 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(import): plan 1.8 - Import/export, inbound webhook & AI Text-to-Lead" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
