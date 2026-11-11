# Plan 1.1 — Authentication

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | §9.1, §10.2; Sprint 1                       |
| Prioritas       | P0                                          |
| Bergantung pada | Phase 0                                     |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Pengguna dapat mendaftar, login, logout, dan reset password dengan session aman.

## Tugas

- [x] Integrasikan Better Auth (adapter Prisma) dengan plugin Organization; migrasi schema auth.
- [x] Halaman: Sign up, Login, Logout, Forgot password, Reset password (form RHF + Zod).
- [x] Session cookie HTTP-only, password hashing kuat, verifikasi email opsional via env.
- [x] Rate limiting pada endpoint auth (login, reset password).
- [x] Proteksi route: middleware/guard yang mengalihkan pengguna belum login ke `/login`.
- [x] Email transaksional untuk reset password (dev: log/mailpit; production: connector email di plan 1.13).
- [x] Test: alur login/logout, reset password, akses ditolak tanpa session.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Better Auth`, `React Hook Form`, `Zod`.

## Acceptance Criteria

- [x] Pengguna dapat register → login → logout → reset password.
- [x] Route privat tidak dapat diakses tanpa session.
- [x] Rate limit aktif pada endpoint sensitif.

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

1. [ ] **Update progress** — ubah status plan 1.1 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(auth): plan 1.1 - Authentication" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
