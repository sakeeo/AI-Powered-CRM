# Intelligent CRM — metodologi, asumsi & batasan (Phase 3)

Semua fitur Phase 3 **read-only / non-autonomous** (Red Zone Policy): menghitung dan menyarankan, tidak pernah
mengubah status, stage, assignment, nominal, atau menghapus/menggabungkan data. Pengguna yang memutuskan.
Setiap fitur prediktif **digerbangi kualitas data** (`src/modules/intelligence/quality.ts`): bila ambang minimum
tidak terpenuhi, UI menampilkan alasan, bukan angka.

| Fitur             | Ambang kesiapan (`evaluateQuality`)                                          |
| ----------------- | ---------------------------------------------------------------------------- |
| Lead scoring      | ≥ 20 lead, ≥ 50% punya email/telepon                                         |
| Prediksi deal     | ≥ 10 deal tertutup, ≥ 3 Won dan ≥ 3 Lost                                     |
| Forecast          | ≥ 10 deal tertutup dan riwayat ≥ 3 bulan kalender                            |
| Deteksi anomali   | ≥ 1 customer dan ≥ 1 aktivitas dalam 90 hari                                 |

Metrik kualitas data tampil di halaman **Intelligence** (`/intelligence`).

## 3.1 Lead scoring

Skor 0–100 deterministik (bukan LLM), dihitung saat dibaca dan **tidak disimpan**. Delapan faktor berbobot
tetap, semuanya ditampilkan beserta penjelasan: kelengkapan kontak (16), kebutuhan (8), budget (12; +4 bila ≥
median lead lain), urgensi (14), status (12), jumlah interaksi (8), kebaruan interaksi (12), konversi historis
sumber (18; hanya bila ≥ 5 lead per sumber). Band: Hot ≥ 70, Warm 40–69, Cold < 40. Lead _unqualified_
dibatasi ≤ 20; lead terkonversi/arsip tidak dinilai.

Batasan: bobot belum dikalibrasi terhadap hasil nyata organisasi; konversi sumber bergantung pada kebiasaan
mengisi sumber lead.

## 3.2 Asisten penjualan prediktif

Probabilitas dasar = win rate historis deal tertutup di pipeline yang sama yang **pernah mencapai stage
ini**, dihaluskan dengan prior probabilitas stage (bobot 4) agar stabil saat sampel kecil. Sinyal
keterlibatan menyesuaikan dengan pengali kecil yang selalu ditampilkan: aktivitas ≤ 7 hari (×1,1), mandek ≥ 14 hari
(×0,85) / ≥ 30 hari (×0,7), lewat perkiraan closing (×0,85), quotation terkirim (×1,05). Saran stage: _advance_
(≥ 2 interaksi sejak masuk stage & aktivitas ≤ 7 hari), _review_ (lewat closing / mandek ≥ 30 hari), atau _stay_.

**Evaluasi akurasi** (`backtestStageModel`): leave-one-out — untuk tiap deal tertutup dan tiap stage yang dicapainya,
prediksi dihitung tanpa deal itu lalu dibandingkan dengan hasil nyata. Dilaporkan akurasi (ambang 50%), Brier score
(0 sempurna, 0,25 = menebak), dan pembanding probabilitas default stage. Ditampilkan di kartu deal dan halaman
Intelligence.

Batasan: pengali sinyal aktivitas bersifat heuristik — tidak ikut di-backtest karena snapshot aktivitas historis
tidak disimpan; titik evaluasi per stage saling berkorelasi (bukan sampel independen), jadi angka akurasi
bersifat indikatif.

## 3.3 Rekomendasi follow-up

Dari interaksi selesai (call/email/meeting/WhatsApp) + pesan WhatsApp lead/contact dalam 180 hari: **kanal** = terbanyak
berbobot (pesan masuk dari pelanggan dihitung 2×), **waktu** = hari-dalam-pekan & jam paling sering (zona waktu
organisasi, jam dibatasi 08–17), **kadens** = median jeda antar interaksi (1–30 hari) → tidak disarankan lebih awal dari
interaksi terakhir + kadens. Basis: pola pelanggan bila ≥ 3 interaksi; jika tidak, pola organisasi bila ≥ 10; jika tidak,
"belum ada pola" (kanal kosong, draf generik) — tidak mengarang pola. **Isi** = draf templat deterministik per kanal.

Kartu muncul di detail lead & Customer 360. **Terima** → membuat _task_ terbuka (dihitung ulang di server, tanpa pesan
terkirim, tanpa duplikat) + umpan balik `accepted`; **Tidak relevan** → umpan balik `rejected` saja. AI Draft
Acceptance Rate = diterima ÷ (diterima + ditolak), ditampilkan di `/intelligence`.

Batasan: "respons pelanggan" hanya diketahui dari pesan WhatsApp masuk; belum ada sinyal balasan email/telepon.

## 3.4 Insight otomatis & deteksi anomali

Job BullMQ (`insights`, worker, tiap 6 jam; juga tombol **Pindai sekarang** untuk Owner/Admin) memindai tiap
organisasi dan menyimpan anomali di `insight_alerts` + notifikasi in-app. Tiga definisi (ambang di `anomalies.ts`):

1. **Aktivitas VIP menurun** — VIP = 20% teratas menurut total pembelian (deal Won, mata uang default organisasi).
   Alert bila interaksi 30 hari terakhir ≤ 25% dari rata-rata 30 harinya pada 90 hari sebelumnya (baseline ≥ 2
   interaksi/30 hari). Interaksi = aktivitas selesai tertaut ke company/contact/deal-nya + pesan WhatsApp contact.
2. **Win rate menurun** — turun ≥ 20 poin dibanding 90 hari sebelumnya (≥ 5 deal tertutup per jendela).
3. **Lead baru menurun** — 14 hari terakhir ≤ 50% rata-rata 14 harinya pada 56 hari sebelumnya (baseline ≥ 8).

Idempoten: satu alert per subjek per pekan (`dedupeKey = kunci:awal-pekan`); anomali yang masih berlangsung muncul lagi
pekan berikutnya. Notifikasi ke Owner/Admin/Sales Manager + pemilik customer. Sales Rep hanya melihat alert customer
miliknya. **Tidak ada aksi otonom** — pemindai hanya menulis `insight_alerts` dan `notifications`; Abaikan hanya
mengubah status alert.

Batasan: total pembelian hanya mata uang default; ambang tetap (belum dapat dikonfigurasi per organisasi).
