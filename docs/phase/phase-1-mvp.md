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

- [ ] Seluruh checklist MVP Release Criteria (PRD §12) terpenuhi.
- [ ] Tenant isolation dan permission lulus automated test (termasuk akses silang tenant).
- [ ] Red Zone Policy AI lulus test enforcement.
- [ ] Backup dan restore telah diuji; deployment production berjalan.
- [ ] Tidak ada bug kritis pada alur utama; UAT disetujui.
- [ ] Semua plan Phase 1 berstatus Done di `docs/PROGRESS.md`.
