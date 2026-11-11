# Plan 1.2 — Organization, membership & user management

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | SET-01, SET-02, SET-04; Sprint 1            |
| Prioritas       | P0                                          |
| Bergantung pada | 1.1                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Workspace organisasi, keanggotaan, undangan pengguna, dan tim berfungsi.

## Tugas

- [x] Buat organisasi saat onboarding; pengguna pertama menjadi Owner.
- [x] Dukung satu pengguna di beberapa organisasi + switcher organisasi (sesuai keputusan di `docs/decisions.md`).
- [x] Organization profile: nama, timezone, mata uang default, format tanggal (SET-01).
- [x] Undang anggota via email dengan token (accept/expire/revoke); daftar & nonaktifkan anggota (SET-02).
- [x] Model Team + TeamMember dan UI manajemen tim (SET-04).
- [x] Tenant context ditentukan dari session + membership, bukan input client.
- [x] Test: undangan, penerimaan, pergantian organisasi.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Better Auth Organization plugin`.

## Acceptance Criteria

- [x] Owner dapat mengundang, mengubah, dan menonaktifkan anggota.
- [x] Pengguna hanya melihat organisasi tempat ia menjadi anggota.
- [x] Tim dapat dibuat dan diisi anggota.

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

1. [ ] **Update progress** — ubah status plan 1.2 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(org): plan 1.2 - Organization, membership & user management" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
