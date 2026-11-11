# Progress Tracker

File ini adalah **satu-satunya sumber status** pengerjaan plan. Diperbarui **setiap kali sebuah plan selesai**, sebelum commit penutup plan.

## Aturan

1. Kerjakan plan secara berurutan sesuai kolom _Bergantung pada_.
2. Saat memulai plan: ubah status menjadi `In progress`.
3. Saat selesai: status `Done`, isi _Selesai_ (YYYY-MM-DD) dan _Catatan_, centang acceptance criteria di file plan.
4. **Di akhir setiap plan wajib commit** (pesan commit memuat nomor plan, mis. `feat(auth): plan 1.1 - Authentication`). Update `PROGRESS.md` ikut di commit yang sama.
5. Status yang dipakai: `Not started`, `In progress`, `Blocked`, `Done`.
6. Phase dinyatakan selesai bila seluruh plan `Done` dan exit criteria pada file phase terpenuhi.

## Ringkasan

| Phase                                                         | Plan Done / Total | Status      |
| ------------------------------------------------------------- | ----------------- | ----------- |
| [Phase 0 — Project Setup](phase/phase-0-setup.md)             | 5 / 5 | Done |
| [Phase 1 — MVP](phase/phase-1-mvp.md)                         | 8 / 20 | In progress |
| [Phase 2 — Business CRM](phase/phase-2-business-crm.md)       | 0 / 7 | Not started |
| [Phase 3 — Intelligent CRM](phase/phase-3-intelligent-crm.md) | 0 / 7 | Not started |
| **Total** | **13 / 39** | |

## Phase 0 — Project Setup

| Plan                             | Judul                                      | Status      | Selesai | Catatan                                                                                                                    |
| -------------------------------- | ------------------------------------------ | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| [0.1](plans/phase-0/plan.0.1.md) | Repository & tooling baseline              | Done | 2026-11-11 | Struktur modul, Prettier/ESLint, validasi env Zod, decisions.md, README, commit awal. |
| [0.2](plans/phase-0/plan.0.2.md) | Dev infrastructure (Redis, object storage) | Done | 2026-11-11 | Redis + MinIO (image chainguard, minio/minio sudah tidak tersedia di Docker Hub), bucket init script, /api/health, helper storage per tenant. |
| [0.3](plans/phase-0/plan.0.3.md) | Database foundation                        | Done | 2026-11-11 | Konvensi UUIDv7/snake_case, helper forTenant + TENANT_MODELS (diuji), seed, DB test crm_test, docs/database.md. Vitest dipasang lebih awal dari plan 0.5. |
| [0.4](plans/phase-0/plan.0.4.md) | UI foundation & app shell                  | Done | 2026-11-11 | shadcn/ui (preset radix-nova, Radix), next-themes, sidebar lipat, Ctrl+K palette, 14 halaman placeholder. Dicek di browser: dark/light, sidebar, palette. Responsif 375/768px diverifikasi Playwright di plan 0.5. |
| [0.5](plans/phase-0/plan.0.5.md) | Testing, logging & CI                      | Done | 2026-11-11 | Vitest (25 test), Playwright (9 E2E incl. responsif 375/768px), Pino + redaksi, error handling + titik error tracking, Dockerfile (72 MB, health ok), CI GitHub Actions. husky dilewati (opsional). |

## Phase 1 — MVP

| Plan                               | Judul                                                  | Status      | Selesai | Catatan                                                                           |
| ---------------------------------- | ------------------------------------------------------ | ----------- | ------- | --------------------------------------------------------------------------------- |
| [1.1](plans/phase-1/plan.1.1.md)   | Authentication                                         | Done | 2026-11-11 | Better Auth (Prisma, UUIDv7, plugin Organization), 4 halaman auth, proxy.ts + requireSession(), rate limit via Redis, reset password via mailer log (connector email di plan 1.13). 20 test integrasi/unit + 6 E2E auth.
| [1.2](plans/phase-1/plan.1.2.md)   | Organization, membership & user management             | Done | 2026-11-11 | Plugin Organization (roles kustom), onboarding Owner, org switcher, profil org (SET-01), undangan + accept + revoke, nonaktifkan anggota, Team/TeamMember (SET-04). Tenant context dari membership (bukan input client). 13 test integrasi + 3 E2E. |
| [1.3](plans/phase-1/plan.1.3.md)   | RBAC, tenant isolation & audit log                     | Done | 2026-11-11 | CASL (matriks 5 role, kondisi kepemilikan/tim), assertCan/scopeWhere, ESLint melarang prisma mentah di modul bisnis, UI Roles & Permissions + Audit Log, AuditLog append-only dengan redaksi secret. Test IDOR lintas tenant untuk semua model TENANT_MODELS + matriks permission. |
| [1.4](plans/phase-1/plan.1.4.md)   | Connector Hub foundation & BYOK AI                     | Done | 2026-11-11 | AES-256-GCM (AAD per tenant+tipe, tamper terdeteksi), TenantConnector, Connector Hub (4 provider BYOK, key bermasker), Test Connection server-side via Vercel AI SDK, getAiModel/runAi (log metadata saja). Key tidak muncul di response/audit/log. 8 test integrasi + 6 test crypto + 1 E2E. |
| [1.5](plans/phase-1/plan.1.5.md)   | Contacts & Companies                                   | Done | 2026-11-11 | Company/Contact/ContactCompany (relasi eksplisit), komponen reusable DataTable (TanStack v8, sort/filter/search/pagination server via URL) + EntitySheet + DeleteEntityButton, soft delete, owner assignment. 8 test integrasi (CRUD, relasi, izin, IDOR) + 1 E2E. |
| [1.6](plans/phase-1/plan.1.6.md)   | Lead management core                                   | Done | 2026-11-11 | Lead + LeadSource (SET-06, default + lazy seed), CRUD/arsip, alur kualifikasi (Unqualified wajib alasan), assignment, scoping Sales Rep (hanya miliknya), uang Decimal (money.ts pure + money-db.ts server). Status lead tetap 4 nilai (konfigurasi label per-org ditunda). 9 test integrasi + 1 E2E. |
| [1.7](plans/phase-1/plan.1.7.md)   | Lead conversion & duplicate detection                  | Done | 2026-11-11 | Deteksi duplikat (email, telepon ternormalisasi, nama+perusahaan) hanya sebagai peringatan di form + kartu duplikat; merge manual contact/company/lead (hook relasi untuk plan berikutnya); konversi lead atomik (contact/company/deal, link/create). 12 test integrasi termasuk rollback + 1 E2E. |
| [1.8](plans/phase-1/plan.1.8.md)   | Import/export, inbound webhook & AI Text-to-Lead       | Not started |         |                                                                                   |
| [1.9](plans/phase-1/plan.1.9.md)   | Pipelines & Deal management                            | Done | 2026-11-11 | Pipeline/PipelineStage/Deal (Won/Lost = outcome, bukan stage), pipeline default + lazy ensure, Settings pipeline (tambah/ubah/urut/arsip stage dengan guard), CRUD deal (Decimal, contact/company wajib salah satu), ringkasan nilai per stage + tertimbang (Decimal), related deals di contact/company. 10 test integrasi + 1 E2E. |
| [1.10](plans/phase-1/plan.1.10.md) | Kanban board, Won/Lost & Deal Risk advisor             | Not started |         |                                                                                   |
| [1.11](plans/phase-1/plan.1.11.md) | Activities, tasks & timeline                           | Not started |         |                                                                                   |
| [1.12](plans/phase-1/plan.1.12.md) | Calendar & AI notes assistant                          | Not started |         |                                                                                   |
| [1.13](plans/phase-1/plan.1.13.md) | Notifications, email delivery & reminder jobs          | Not started |         |                                                                                   |
| [1.14](plans/phase-1/plan.1.14.md) | Product & service catalog                              | Not started |         |                                                                                   |
| [1.15](plans/phase-1/plan.1.15.md) | Quotation builder & PDF                                | Not started |         |                                                                                   |
| [1.16](plans/phase-1/plan.1.16.md) | Customer retention & Customer 360                      | Not started |         |                                                                                   |
| [1.17](plans/phase-1/plan.1.17.md) | Dashboard                                              | Not started |         |                                                                                   |
| [1.18](plans/phase-1/plan.1.18.md) | Reports, export & Lost Reason categorizer              | Not started |         |                                                                                   |
| [1.19](plans/phase-1/plan.1.19.md) | QA, security & performance hardening                   | Not started |         |                                                                                   |
| [1.20](plans/phase-1/plan.1.20.md) | Release: backup/restore, monitoring, deployment & docs | Not started |         |                                                                                   |

## Phase 2 — Business CRM

| Plan                             | Judul                                                       | Status      | Selesai | Catatan |
| -------------------------------- | ----------------------------------------------------------- | ----------- | ------- | ------- |
| [2.1](plans/phase-2/plan.2.1.md) | Tags, custom fields & saved views                           | Not started |         |         |
| [2.2](plans/phase-2/plan.2.2.md) | Workflow automation engine                                  | Not started |         |         |
| [2.3](plans/phase-2/plan.2.3.md) | WhatsApp Business gateway & shared inbox                    | Not started |         |         |
| [2.4](plans/phase-2/plan.2.4.md) | Calendar, email sync & Zapier/Make                          | Not started |         |         |
| [2.5](plans/phase-2/plan.2.5.md) | AI: Quotation Narrative Drafter & Natural Language Insights | Not started |         |         |
| [2.6](plans/phase-2/plan.2.6.md) | Advanced reporting & customer segmentation                  | Not started |         |         |
| [2.7](plans/phase-2/plan.2.7.md) | Quotation versioning, approval & repeat purchase            | Not started |         |         |

## Phase 3 — Intelligent CRM

| Plan                             | Judul                                           | Status      | Selesai | Catatan |
| -------------------------------- | ----------------------------------------------- | ----------- | ------- | ------- |
| [3.1](plans/phase-3/plan.3.1.md) | AI lead scoring                                 | Not started |         |         |
| [3.2](plans/phase-3/plan.3.2.md) | Predictive sales assistant                      | Not started |         |         |
| [3.3](plans/phase-3/plan.3.3.md) | AI follow-up recommendation                     | Not started |         |         |
| [3.4](plans/phase-3/plan.3.4.md) | Automated customer insights & anomaly detection | Not started |         |         |
| [3.5](plans/phase-3/plan.3.5.md) | Probabilistic sales forecasting                 | Not started |         |         |
| [3.6](plans/phase-3/plan.3.6.md) | Omnichannel communication hub                   | Not started |         |         |
| [3.7](plans/phase-3/plan.3.7.md) | Outbound webhooks for ERP/POS/Accounting        | Not started |         |         |
