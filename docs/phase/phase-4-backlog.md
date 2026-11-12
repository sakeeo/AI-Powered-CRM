# Phase 4 — Backlog (usulan, belum ada di PRD)

PRD §15 berhenti di Phase 3. Dokumen ini mengumpulkan **utang & batasan yang tercatat selama Phase 1–3** sebagai bahan
Phase 4. Belum ada plan/prioritas final — tiap butir perlu dipertajam sebelum dimulai (format plan seperti `docs/plans/`).
Sumber tiap butir: catatan di `docs/PROGRESS.md`, `docs/decisions.md`, `docs/intelligence.md`, `docs/webhooks.md`.

## A. Prasyarat rilis (blokir go-live, bukan fitur baru)

- [ ] **Plan 1.20 tuntas**: deploy ke server nyata (HTTPS), UAT dengan pengguna awal (`docs/uat.md`), tag `v1.0.0`.
- [ ] **Verifikasi integrasi dengan kredensial sungguhan** — semua baru diuji dengan mock `fetch`: Fonnte/gateway WhatsApp (2.3),
  Google OAuth/Calendar/Gmail (2.4), Zapier/Make & endpoint ERP/POS (2.4, 3.7), connector email delivery.
- [ ] Worker produksi: pastikan job `insights` (6 jam) dan scheduler lain terdaftar & termonitor (health check/alert).

## B. Kualitas model Phase 3 (setelah ada data nyata)

- [ ] **Kalibrasi bobot lead scoring** terhadap konversi nyata organisasi; evaluasi apakah bobot tetap cukup.
- [ ] **Backtest pengali sinyal aktivitas** (3.2) — butuh snapshot aktivitas historis per deal (saat ini heuristik, tidak di-backtest).
- [ ] **Forecast**: korelasi antar deal/musiman, multi-mata-uang, bulan mengikuti zona waktu organisasi, simpan `expectedCloseDate` historis
  agar backtest tidak memakai tanggal terkini.
- [ ] **Ambang anomali dapat dikonfigurasi per organisasi** (VIP, penurunan %, jendela); VIP lintas mata uang.
- [ ] Sinyal "respons pelanggan" untuk follow-up selain WhatsApp masuk (balasan email, durasi telepon).
- [ ] Laporan monitoring kualitas model berkala (akurasi, coverage, acceptance rate) agar drift terlihat.

## C. Omnichannel & integrasi (batasan 3.6/3.7/2.4)

- [ ] Email: **IMAP** (ditunda, keputusan #16), isi email lebih lengkap/threading per subjek, kirim dari kotak pengguna.
- [ ] Kanal tambahan terintegrasi (Instagram/Telegram/SMS) menggantikan pencatatan manual.
- [ ] Routing lanjutan: berbasis tim/skill/jam kerja, SLA & eskalasi percakapan belum dibalas.
- [ ] Webhook: **inbound** dua arah dari ERP/POS (sinkron balik status/invoice), urutan event terjamin, versi skema v2 + masa transisi,
  rotasi secret tanpa downtime, filter event per field.
- [ ] Connector bawaan (bukan hanya webhook) untuk akuntansi/ERP populer.

## D. Skala, keamanan & operasional

- [ ] Batas kapasitas dari `docs/performance.md` (P95 < 500 ms hanya sampai ±4 koneksi/instance): optimasi query/caching,
  skala horizontal, pemisahan worker; load test ulang termasuk halaman Phase 3 (scoring per halaman, forecast, timeline terpadu).
- [ ] Kebijakan retensi & penghapusan data final (keputusan #8 masih "Diusulkan"); hard-delete/anonimisasi, ekspor data tenant.
- [ ] Keputusan privasi log AI (#10): saat ini hanya metadata; tinjau bila butuh evaluasi kualitas.
- [ ] Tinjau ulang keamanan Phase 2–3 (OWASP, tenant isolation untuk tabel baru, `npm audit`) — `docs/security-review.md` baru mencakup MVP.
- [ ] Observabilitas: metrik job BullMQ (antrean, gagal, dead-letter), dashboard biaya/penggunaan AI per tenant.

## E. Produk (kandidat; perlu validasi kebutuhan)

- [ ] Konfigurasi UI untuk bobot/ambang fitur cerdas (admin), mode "jelaskan keputusan" yang lebih kaya.
- [ ] Aplikasi/PWA mobile untuk sales lapangan; notifikasi push.
- [ ] Billing/plan & kuota per tenant (SaaS-ready, PRD §16), onboarding self-serve.
- [ ] i18n (saat ini UI berbahasa Indonesia), format tanggal/uang per organisasi di seluruh fitur baru.
- [ ] Aksesibilitas: audit WCAG untuk komponen Phase 3 (grafik forecast, timeline, inbox).

## Aturan yang tetap berlaku

Red Zone Policy (non-autonomous, tanpa perhitungan finansial oleh AI, human-approved), tenant isolation ketat, dan
Library-First (PRD §10.2) tetap mengikat semua pekerjaan Phase 4.
