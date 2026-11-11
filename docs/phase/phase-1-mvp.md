# Phase 1 — MVP

**Referensi PRD:** PRD §3, §4, §6, §11 (Sprint 1–8), §12

## Tujuan

Merilis MVP sesuai PRD §12: alur Lead → Deal → Activity → Quotation → Customer dengan multi-tenancy, RBAC, Connector Hub BYOK, Safe AI (human-in-the-loop), dashboard, dan laporan dasar.

## Lingkup

- Auth, organisasi, anggota, RBAC, tenant isolation, audit log (Sprint 1).
- Connector Hub + BYOK AI + Email delivery + Inbound webhook (Sprint 1, 2, 4).
- Lead, Contact, Company, konversi, duplikat, import/export (Sprint 2).
- Pipeline, Kanban, Deal, Won/Lost (Sprint 3).
- Activity, task, timeline, kalender, notifikasi, reminder (Sprint 4).
- Produk, quotation, PDF (Sprint 5).
- Customer retention dan Customer 360 (Sprint 6).
- Dashboard, laporan, export (Sprint 7).
- QA, security, backup/restore, deployment, dokumentasi (Sprint 8).
- Safe AI P1: Text-to-Lead, Summarizer, Action Item, Ghostwriter, Customer 360 Briefing, Deal Risk, Lost Reason Categorizer.

## Di Luar Lingkup

- Fitur P2 dan out-of-scope MVP (PRD §3.2) — termasuk AI Red Zone: tidak ada auto-send, auto-calc finansial, auto-mutate status, auto-merge/delete.
- Tags & custom fields penuh, workflow automation, WhatsApp gateway (Phase 2).

## Daftar Plan

| Plan                                  | Judul                                                  | Prioritas | Bergantung pada  |
| ------------------------------------- | ------------------------------------------------------ | --------- | ---------------- |
| [1.1](../plans/phase-1/plan.1.1.md)   | Authentication                                         | P0        | Phase 0          |
| [1.2](../plans/phase-1/plan.1.2.md)   | Organization, membership & user management             | P0        | 1.1              |
| [1.3](../plans/phase-1/plan.1.3.md)   | RBAC, tenant isolation & audit log                     | P0        | 1.2              |
| [1.4](../plans/phase-1/plan.1.4.md)   | Connector Hub foundation & BYOK AI                     | P0        | 1.3              |
| [1.5](../plans/phase-1/plan.1.5.md)   | Contacts & Companies                                   | P0        | 1.3              |
| [1.6](../plans/phase-1/plan.1.6.md)   | Lead management core                                   | P0        | 1.5              |
| [1.7](../plans/phase-1/plan.1.7.md)   | Lead conversion & duplicate detection                  | P0        | 1.6              |
| [1.8](../plans/phase-1/plan.1.8.md)   | Import/export, inbound webhook & AI Text-to-Lead       | P0        | 1.6, 1.4         |
| [1.9](../plans/phase-1/plan.1.9.md)   | Pipelines & Deal management                            | P0        | 1.5              |
| [1.10](../plans/phase-1/plan.1.10.md) | Kanban board, Won/Lost & Deal Risk advisor             | P0        | 1.9              |
| [1.11](../plans/phase-1/plan.1.11.md) | Activities, tasks & timeline                           | P0        | 1.6, 1.9         |
| [1.12](../plans/phase-1/plan.1.12.md) | Calendar & AI notes assistant                          | P0        | 1.11, 1.4        |
| [1.13](../plans/phase-1/plan.1.13.md) | Notifications, email delivery & reminder jobs          | P0        | 1.11, 0.2        |
| [1.14](../plans/phase-1/plan.1.14.md) | Product & service catalog                              | P1        | 1.5              |
| [1.15](../plans/phase-1/plan.1.15.md) | Quotation builder & PDF                                | P1        | 1.14, 1.9        |
| [1.16](../plans/phase-1/plan.1.16.md) | Customer retention & Customer 360                      | P1        | 1.10, 1.11       |
| [1.17](../plans/phase-1/plan.1.17.md) | Dashboard                                              | P1        | 1.10, 1.11, 1.15 |
| [1.18](../plans/phase-1/plan.1.18.md) | Reports, export & Lost Reason categorizer              | P1        | 1.17             |
| [1.19](../plans/phase-1/plan.1.19.md) | QA, security & performance hardening                   | P0        | 1.1–1.18         |
| [1.20](../plans/phase-1/plan.1.20.md) | Release: backup/restore, monitoring, deployment & docs | P0        | 1.19             |

## Kriteria Selesai Phase (Exit Criteria)

- [x] Seluruh checklist MVP Release Criteria (PRD §12) terpenuhi — diverifikasi 2026-11-12 terhadap kode/test (tabel bukti di bawah).
- [x] Tenant isolation dan permission lulus automated test (termasuk akses silang tenant) — `tenant-isolation.test.ts`, `security.test.ts`, `abilities.test.ts`.
- [x] Red Zone Policy AI lulus test enforcement — `security.test.ts` (pemindaian sumber + snapshot semua tabel).
- [ ] Backup dan restore telah diuji (✅ restore drill 2026-11-12, `docs/backup-restore.md`); **deployment production berjalan (⏳ menunggu server/domain dari pemilik produk — `docs/deployment.md`)**.
- [ ] Tidak ada bug kritis pada alur utama (✅ E2E alur penuh hijau); **UAT disetujui (⏳ belum dijalankan — skenario di `docs/uat.md`)**.
- [ ] Semua plan Phase 1 berstatus Done di `docs/PROGRESS.md` (19/20; plan 1.20 menunggu deployment production + UAT + tag `v1.0.0`).

## Bukti verifikasi MVP Release Criteria (PRD §12)

| Kriteria | Bukti |
| --- | --- |
| Organisasi dapat membuat workspace | `organizations.test.ts`, E2E `organization.spec.ts` |
| Admin dapat mengundang anggota | `organizations.test.ts` (undangan, accept, revoke) |
| Data antarorganisasi terisolasi & teruji | `tenant-isolation.test.ts`, `security.test.ts` |
| Permission di backend | CASL `assertCan`/`scopeWhere` + `abilities.test.ts`, test izin tiap modul |
| Lead → deal | `leads`, `duplicates-conversion` tests; E2E `conversion.spec.ts`, `full-flow.spec.ts` |
| Deal di Kanban | `kanban.test.ts`, E2E `kanban.spec.ts` |
| Aktivitas & follow-up terjadwal | `activities.test.ts`, `notifications-email.test.ts` (reminder idempoten) |
| Riwayat aktivitas tertelusur | Timeline di 4 detail + Customer 360; `DealStageHistory`; audit log |
| Quotation + PDF | `quotations.test.ts` (PDF `%PDF-`, storage tenant), `quotation-calc.test.ts`, E2E `quotations.spec.ts` |
| Dashboard data aktual | `dashboard.test.ts` (angka = data seed), `docs/metrics.md` |
| Import/export dasar | `import-export-webhook.test.ts`, E2E `import-export.spec.ts` |
| Responsif desktop & smartphone | `responsive.spec.ts` (15 halaman × 375/768 px, desktop) |
| Backup & restore diuji | `scripts/restore-drill.sh` — berhasil 2026-11-12 (`docs/backup-restore.md`) |
| Connector Hub mandiri (AI, Webhook, Email) | `connectors`, `import-export-webhook`, `notifications-email` tests; E2E `connectors.spec.ts`, `notifications.spec.ts` |
| Safe AI human-in-the-loop | `security.test.ts` + test AI per modul (draf, tidak menyimpan) |
| Tidak ada bug kritis alur utama | E2E `full-flow.spec.ts` hijau; tinjauan keamanan `docs/security-review.md` |
