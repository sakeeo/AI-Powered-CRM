# Phase 3 — Intelligent CRM

**Referensi PRD:** PRD §15 (Phase 3)

## Tujuan

Menambahkan kecerdasan prediktif dan omnichannel di atas data yang sudah berkualitas — seluruhnya non-autonomous dan tunduk pada Red Zone Policy.

> Plan Phase 3 bersifat ringkas dan **wajib dipertajam** sebelum dimulai. AI hanya ditambahkan bila kualitas data dan proses bisnis sudah memadai (PRD §15).

## Lingkup

- AI lead scoring, asisten penjualan prediktif, rekomendasi follow-up.
- Insight otomatis & deteksi anomali; forecasting probabilistik.
- Omnichannel communication hub.
- Integrasi ERP/POS/accounting via webhook outbound.

## Di Luar Lingkup

- Tindakan otonom AI (auto-send, auto-calc finansial, auto-mutate status, auto-merge/delete) — tetap dilarang.

## Daftar Plan

| Plan                                | Judul                                           | Prioritas | Bergantung pada |
| ----------------------------------- | ----------------------------------------------- | --------- | --------------- |
| [3.1](../plans/phase-3/plan.3.1.md) | AI lead scoring                                 | P2        | Phase 2         |
| [3.2](../plans/phase-3/plan.3.2.md) | Predictive sales assistant                      | P2        | 3.1             |
| [3.3](../plans/phase-3/plan.3.3.md) | AI follow-up recommendation                     | P2        | 3.1             |
| [3.4](../plans/phase-3/plan.3.4.md) | Automated customer insights & anomaly detection | P2        | Phase 2         |
| [3.5](../plans/phase-3/plan.3.5.md) | Probabilistic sales forecasting                 | P2        | 3.2             |
| [3.6](../plans/phase-3/plan.3.6.md) | Omnichannel communication hub                   | P2        | 2.3             |
| [3.7](../plans/phase-3/plan.3.7.md) | Outbound webhooks for ERP/POS/Accounting        | P2        | 2.4             |

## Kriteria Selesai Phase (Exit Criteria)

- [ ] Semua plan Phase 3 Done di `docs/PROGRESS.md`.
- [ ] Semua fitur AI read-only/non-autonomous dan lulus test Red Zone.
- [ ] Kualitas data memadai (dibuktikan metrik) sebelum fitur prediktif diaktifkan.
