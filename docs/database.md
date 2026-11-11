# Database

PostgreSQL 16 (Docker Compose, host port 5434) + Prisma 7 (driver adapter `@prisma/adapter-pg`). Client dihasilkan ke `src/generated/prisma` (tidak di-commit; jalankan `npm run db:generate`).

## Konvensi schema (PRD §7.4)

| Aspek       | Aturan                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| Primary key | `String @id @default(uuid(7)) @db.Uuid` (UUID v7, urut waktu)                               |
| Tenant      | Semua model bisnis wajib `organizationId` + `@@index([organizationId])`; unique mempertimbangkan tenant |
| Audit       | `createdAt`, `updatedAt` (`Timestamptz`, UTC), `createdBy`, `updatedBy` (nullable)          |
| Soft delete | `deletedAt DateTime?` bila perlu                                                            |
| Uang        | `Decimal @db.Decimal(18, 2)` + kolom `currency` (ISO 4217). Jangan `Float`                  |
| Penamaan    | Model PascalCase, field camelCase; tabel & kolom snake_case via `@@map` / `@map`            |

Header schema di `prisma/schema.prisma` merangkum aturan ini.

## Tenant scope

Semua akses ke model bisnis di kode server **wajib** lewat `forTenant(prisma, organizationId)` ([src/lib/tenant.ts](../src/lib/tenant.ts)):

- `create*` menyisipkan `organizationId`; `find*/update*/delete*/count/aggregate/groupBy/upsert` meng-AND `organizationId` ke `where`.
- `organizationId` yang berbeda dari tenant aktif ditolak (`TenantScopeError`).
- `organizationId` berasal dari session terautentikasi, **bukan** input client.
- Setiap model baru ber-`organizationId` harus didaftarkan di `TENANT_MODELS`; test `tenant-models.test.ts` menggagalkan build bila lupa.
- Raw query (`$queryRaw`) tidak otomatis ter-scope — hindari untuk model bisnis, atau sertakan `organization_id` manual.

Pengujian akses silang tenant yang menyeluruh dikerjakan di plan 1.3.

## Alur migrasi

| Lingkungan | Perintah                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Development | ubah `schema.prisma` → `npm run db:migrate -- --name <nama>` (commit folder migrasi)          |
| Review SQL  | `npx prisma migrate dev --create-only --name <nama>` lalu periksa `migration.sql` sebelum apply |
| CI / Production | `npm run db:deploy` (hanya menerapkan migrasi yang sudah ada; tidak pernah `migrate dev`)  |
| Test        | `npm run db:test:setup` (membuat `crm_test` + `migrate deploy`)                                |

Jangan mengedit migrasi yang sudah di-commit/diterapkan; buat migrasi baru. `npm run db:reset` menghapus seluruh data development.

## Seed & test

- `npm run db:seed` — `prisma/seed.ts` (organisasi demo, idempoten via upsert).
- `npm test` — Vitest memakai database terpisah `crm_test`; helper `resetDb()` di `tests/helpers/db.ts` mengosongkan tabel antar test.
- `npm run db:studio` — Prisma Studio.

## Akses data di module (plan 1.3)

- Kode di `src/modules/**` memakai `ctx.db` (hasil `requireTenant()` / `tenantAction`) — ESLint (`no-restricted-imports`) melarang `@/lib/prisma` di sana. Pengecualian hanya `modules/organizations` dan `modules/audit` (akar tenant: keanggotaan, profil org, audit).
- Izin: `assertCan(ctx, action, subject, record?)` untuk satu record, `scopeWhere(ctx, action, subject)` untuk query daftar (kondisi kepemilikan/tim dari CASL → filter Prisma). Definisi izin tunggal di `src/lib/abilities.ts`.
- Perubahan penting dicatat dengan `writeAudit(ctx, …)`; before/after disamarkan otomatis untuk key bernama secret/token/password/api key.
