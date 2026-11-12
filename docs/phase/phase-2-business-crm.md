# Phase 2 — Business CRM

**Referensi PRD:** PRD §15 (Phase 2), P2 pada §4

## Tujuan

Memperluas MVP menjadi CRM bisnis penuh: kustomisasi data, automation, komunikasi (WhatsApp/shared inbox), sinkronisasi kalender/email, dan insight AI tambahan.

> Detail task Phase 2 dan seterusnya bersifat ringkas dan **wajib dipertajam** (tambahkan task rinci) sebelum plan dimulai, berdasarkan pembelajaran dari MVP.

## Lingkup

- Tags, custom fields (conditional logic), saved views, advanced reporting.
- Workflow automation berbasis event & rule dengan log eksekusi.
- WhatsApp Business via gateway dan shared inbox.
- Sinkronisasi Google Calendar/email; Zapier/Make webhook.
- AI: Quotation Narrative Drafter dan Natural Language CRM Insights.
- Quotation versioning, activity template, repeat purchase.

## Di Luar Lingkup

- Fitur Phase 3 (AI prediktif, forecasting, omnichannel penuh).

## Daftar Plan

| Plan                                | Judul                                                       | Prioritas | Bergantung pada |
| ----------------------------------- | ----------------------------------------------------------- | --------- | --------------- |
| [2.1](../plans/phase-2/plan.2.1.md) | Tags, custom fields & saved views                           | P1        | Phase 1         |
| [2.2](../plans/phase-2/plan.2.2.md) | Workflow automation engine                                  | P1        | 2.1             |
| [2.3](../plans/phase-2/plan.2.3.md) | WhatsApp Business gateway & shared inbox                    | P1        | 2.2             |
| [2.4](../plans/phase-2/plan.2.4.md) | Calendar, email sync & Zapier/Make                          | P2        | 2.2             |
| [2.5](../plans/phase-2/plan.2.5.md) | AI: Quotation Narrative Drafter & Natural Language Insights | P2        | Phase 1         |
| [2.6](../plans/phase-2/plan.2.6.md) | Advanced reporting & customer segmentation                  | P1        | 2.1             |
| [2.7](../plans/phase-2/plan.2.7.md) | Quotation versioning, approval & repeat purchase            | P2        | Phase 1         |

## Kriteria Selesai Phase (Exit Criteria)

- [x] Semua plan Phase 2 Done di `docs/PROGRESS.md`.
- [x] Red Zone Policy tetap terpenuhi untuk seluruh fitur AI baru.
- [x] Tidak ada regresi pada kriteria MVP (test suite Phase 1 tetap hijau).
