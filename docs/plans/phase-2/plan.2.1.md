# Plan 2.1 — Tags, custom fields & saved views

| Item            | Detail                                                        |
| --------------- | ------------------------------------------------------------- |
| Phase           | [Phase 2 — Business CRM](../../phase/phase-2-business-crm.md) |
| Referensi PRD   | LEAD-07, CONT-06/07, SET-07/08; §15                           |
| Prioritas       | P1                                                            |
| Bergantung pada | Phase 1                                                       |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                        |

## Tujuan

Organisasi dapat menyesuaikan data tanpa mengubah kode.

## Tugas

- [x] Tags management + relasi `taggables` polymorphic.
- [x] Custom field definitions/values (JSONB) untuk lead, contact, company, deal, dengan tipe & validasi.
- [x] Conditional logic dasar pada custom field.
- [x] Saved views untuk data table (filter, kolom, sort).
- [x] Test isolasi tenant & validasi tipe.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `TanStack Table`, `Zod`.

## Acceptance Criteria

- [x] Custom field muncul di form, tabel, filter, import/export.
- [x] Saved view tersimpan per pengguna/tim.

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

1. [x] **Update progress** — ubah status plan 2.1 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(customization): plan 2.1 - Tags, custom fields & saved views" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
