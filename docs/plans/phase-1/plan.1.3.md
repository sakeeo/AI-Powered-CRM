# Plan 1.3 — RBAC, tenant isolation & audit log

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | §2.1, §7.3, §9.1, SET-03, SET-10; Sprint 1  |
| Prioritas       | P0                                          |
| Bergantung pada | 1.2                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Hak akses ditegakkan di backend, data antartenant terisolasi dan teruji, perubahan penting tercatat.

## Tugas

- [ ] Definisikan role Owner/Admin/Sales Manager/Sales Rep/Viewer dan matriks permission (view/create/update/delete/export).
- [ ] Implementasi CASL: ability per role + kondisi kepemilikan record/tim; dipakai di server (guard) dan UI (sembunyikan aksi).
- [ ] Lengkapi tenant-scoped Prisma client dari plan 0.3 dan wajibkan penggunaannya di semua module server code.
- [ ] UI Roles & Permissions (SET-03) sebatas melihat matriks dan menetapkan role anggota.
- [ ] Model + helper `AuditLog` (siapa, apa, entitas, before/after, waktu, IP); UI daftar audit log (SET-10).
- [ ] Test wajib: akses silang tenant (IDOR) gagal untuk read/update/delete; test matriks permission per role.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `CASL (`@casl/ability`)`.

## Acceptance Criteria

- [ ] Test cross-tenant lulus untuk semua entitas yang ada.
- [ ] Aksi tanpa permission ditolak di API (403) dan disembunyikan di UI.
- [ ] Perubahan role/anggota/organisasi tercatat di audit log.

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

1. [ ] **Update progress** — ubah status plan 1.3 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(rbac): plan 1.3 - RBAC, tenant isolation & audit log" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
