# User Acceptance Testing (UAT) — MVP

> **Status: belum dijalankan.** UAT membutuhkan pengguna awal yang nyata dan lingkungan production/staging; ini tidak dapat dilakukan secara otomatis. Dokumen ini adalah skenario dan lembar catatan temuan untuk dijalankan oleh pemilik produk.

Peserta: ≥ 2 pengguna awal (satu Owner/Admin, satu Sales). Lingkungan: staging/production dengan data nyata/ujian. Catat setiap temuan di tabel bawah; semua temuan berseverity Tinggi harus selesai sebelum rilis.

## Skenario

| # | Skenario | Hasil yang diharapkan | Lulus? |
| --- | --- | --- | --- |
| 1 | Daftar, buat organisasi, undang rekan, rekan menerima undangan lewat email | Anggota masuk dengan peran benar | ☐ |
| 2 | Hubungkan Email Delivery dan kirim email uji; hubungkan AI key dan Test Connection | Email uji diterima; AI terhubung | ☐ |
| 3 | Impor 20+ lead dari CSV (termasuk baris salah) | Baris valid masuk; laporan error jelas | ☐ |
| 4 | Kirim lead dari form website via webhook (signature benar & salah) | Benar → lead "Website"; salah → ditolak | ☐ |
| 5 | Tempel pesan WA di "Dari teks (AI)", koreksi draf, Simpan | Lead hanya dibuat setelah Simpan | ☐ |
| 6 | Qualify → konversi lead menjadi contact + deal | Data tertaut, aktivitas ikut | ☐ |
| 7 | Geser deal di Kanban, tandai Lost dengan alasan, Won pada deal lain | Riwayat stage & hasil tercatat | ☐ |
| 8 | Buat task bertenggat dekat; tunggu reminder (bell + email) | Reminder sekali, tepat waktu | ☐ |
| 9 | Buat quotation dari deal dengan diskon & pajak; unduh PDF | Total cocok perhitungan manual; PDF terbuka | ☐ |
| 10 | Cek Customer muncul setelah Won; catat complaint; Briefing AI | Customer otomatis; briefing berupa draf | ☐ |
| 11 | Login sebagai Sales Rep: hanya data miliknya terlihat; tidak ada tombol Export | Sesuai peran | ☐ |
| 12 | Dashboard & Reports cocok dengan data yang dibuat; export laporan | Angka konsisten | ☐ |
| 13 | Gunakan dari smartphone | Layout nyaman, tidak ada overflow | ☐ |

## Catatan temuan

| # | Tanggal | Pelapor | Deskripsi | Severity | Status | Perbaikan |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

Persetujuan UAT: ________________ (nama/tanggal)
