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
| [Phase 0 — Project Setup](phase/phase-0-setup.md)             | 3 / 5 | In progress |
| [Phase 1 — MVP](phase/phase-1-mvp.md)                         | 0 / 20 | Not started |
| [Phase 2 — Business CRM](phase/phase-2-business-crm.md)       | 0 / 7 | Not started |
| [Phase 3 — Intelligent CRM](phase/phase-3-intelligent-crm.md) | 0 / 7 | Not started |
| **Total** | **3 / 39** | |

## Phase 0 — Project Setup

| Plan                             | Judul                                      | Status      | Selesai | Catatan                                                                                                                    |
| -------------------------------- | ------------------------------------------ | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| [0.1](plans/phase-0/plan.0.1.md) | Repository & tooling baseline              | Done | 2026-11-11 | Struktur modul, Prettier/ESLint, validasi env Zod, decisions.md, README, commit awal. |
| [0.2](plans/phase-0/plan.0.2.md) | Dev infrastructure (Redis, object storage) | Done | 2026-11-11 | Redis + MinIO (image chainguard, minio/minio sudah tidak tersedia di Docker Hub), bucket init script, /api/health, helper storage per tenant. |
| [0.3](plans/phase-0/plan.0.3.md) | Database foundation                        | Done | 2026-11-11 | Konvensi UUIDv7/snake_case, helper forTenant + TENANT_MODELS (diuji), seed, DB test crm_test, docs/database.md. Vitest dipasang lebih awal dari plan 0.5. |
| [0.4](plans/phase-0/plan.0.4.md) | UI foundation & app shell                  | Not started |         |                                                                                                                            |
| [0.5](plans/phase-0/plan.0.5.md) | Testing, logging & CI                      | Not started |         |                                                                                                                            |

## Phase 1 — MVP

| Plan                               | Judul                                                  | Status      | Selesai | Catatan                                                                           |
| ---------------------------------- | ------------------------------------------------------ | ----------- | ------- | --------------------------------------------------------------------------------- |
| [1.1](plans/phase-1/plan.1.1.md)   | Authentication                                         | Not started |         |                                                                                   |
| [1.2](plans/phase-1/plan.1.2.md)   | Organization, membership & user management             | Not started |         |                                                                                   |
| [1.3](plans/phase-1/plan.1.3.md)   | RBAC, tenant isolation & audit log                     | Not started |         |                                                                                   |
| [1.4](plans/phase-1/plan.1.4.md)   | Connector Hub foundation & BYOK AI                     | Not started |         |                                                                                   |
| [1.5](plans/phase-1/plan.1.5.md)   | Contacts & Companies                                   | Not started |         |                                                                                   |
| [1.6](plans/phase-1/plan.1.6.md)   | Lead management core                                   | Not started |         |                                                                                   |
| [1.7](plans/phase-1/plan.1.7.md)   | Lead conversion & duplicate detection                  | Not started |         | Bila model Deal belum ada, kerjakan setelah plan 1.9 atau sertakan model minimal. |
| [1.8](plans/phase-1/plan.1.8.md)   | Import/export, inbound webhook & AI Text-to-Lead       | Not started |         |                                                                                   |
| [1.9](plans/phase-1/plan.1.9.md)   | Pipelines & Deal management                            | Not started |         |                                                                                   |
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
