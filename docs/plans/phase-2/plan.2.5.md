# Plan 2.5 — AI: Quotation Narrative Drafter & Natural Language Insights

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | AI-08, §15                                                    |
| Prioritas       | P2                                                            |
| Bergantung pada | Phase 1                                                       |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Draf narasi quotation dan tanya data dengan bahasa natural, tetap human-in-the-loop.

## Tugas

- [ ] Quotation Narrative Drafter: draf teks pengantar/SOW (angka tetap dari kode deterministik).
- [ ] Natural Language CRM Insights: pertanyaan → query terbatas read-only dengan tenant scope & permission user.
- [ ] Guardrail: tidak ada penulisan data, tidak ada auto-send; log prompt sesuai keputusan privasi.
- [ ] Test Red Zone & kebocoran lintas tenant.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Vercel AI SDK`.

## Acceptance Criteria

- [ ] Draf narasi dapat diedit sebelum dipakai.
- [ ] Insight hanya membaca data yang boleh diakses user.

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

1. [ ] **Update progress** — ubah status plan 2.5 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(ai): plan 2.5 - AI: Quotation Narrative Drafter & Natural Language Insights" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
