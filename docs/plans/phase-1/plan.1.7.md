# Plan 1.7 — Lead conversion & duplicate detection

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | LEAD-08, LEAD-09; Sprint 2                  |
| Prioritas       | P0                                          |
| Bergantung pada | 1.6                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

> **Catatan:** Bila model Deal belum ada, kerjakan setelah plan 1.9 atau sertakan model minimal.

## Tujuan

Lead terkualifikasi dapat dikonversi menjadi contact/company/deal tanpa duplikasi buta.

## Tugas

- [ ] Deteksi duplikat dasar (email, telepon, nama+perusahaan) saat membuat/mengimpor lead/contact; hanya menampilkan peringatan.
- [ ] Alur Convert Lead: cocokkan atau buat Contact & Company, buat Deal (stub sampai plan 1.9, atau gunakan model Deal jika sudah ada).
- [ ] Tampilkan hasil konversi dan tautkan riwayat lead ke record baru.
- [ ] Pastikan konversi berjalan dalam satu transaksi database.
- [ ] Workflow merge duplikat manual (user memutuskan; tidak ada auto-merge).
- [ ] Test: konversi sukses, rollback bila gagal, duplikat terdeteksi.

## Acceptance Criteria

- [ ] Konversi membuat/menautkan contact, company, deal secara atomik.
- [ ] Duplikat potensial ditandai tanpa penggabungan otomatis.

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

1. [ ] **Update progress** — ubah status plan 1.7 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(leads): plan 1.7 - Lead conversion & duplicate detection" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
