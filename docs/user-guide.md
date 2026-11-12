# Panduan Pengguna (MVP)

Panduan singkat untuk alur kerja utama. Semua fitur AI hanya menghasilkan **draf** yang harus Anda periksa dan simpan sendiri.

## 1. Memulai

1. **Daftar** di halaman Sign up, lalu buat **organisasi** (nama, zona waktu, mata uang). Anda menjadi **Owner**.
2. **Undang tim**: Users & Teams → Undang (peran: Admin, Sales Manager, Sales Rep, Viewer). Undangan dikirim lewat email (butuh Email Delivery, langkah 3).
3. **Connectors** (Settings → Connectors): hubungkan **Email Delivery** (SMTP/Resend, klik _Kirim email uji_), **AI** (API key Anda sendiri — Gemini/OpenAI/Anthropic/OpenRouter), dan **Webhook** form website (salin URL & secret; secret hanya tampil sekali).
4. Atur **Lead Source**, **Pipeline** (stage & probabilitas), dan **Quotation** (pajak, masa berlaku) di Settings.
5. Sesuaikan data tanpa kode (Settings → **Tags** dan **Custom Fields**): tag berwarna untuk lead/contact/company/deal, dan isian tambahan (teks, angka, tanggal, ya/tidak, pilihan, URL) yang dapat wajib diisi, tampil di tabel, difilter, diimpor/diekspor, serta tampil hanya bila field lain bernilai tertentu (logika kondisional). Di tabel Leads/Contacts/Companies/Deals, **Simpan tampilan** menyimpan filter, pencarian, dan urutan (pribadi, tim, atau organisasi; bisa dijadikan bawaan ★).

6. **Automation** (Settings → Automation, Owner/Admin): rule "ketika … maka …" — trigger: lead dibuat, deal Won, task jatuh tempo, quotation mendekati kedaluwarsa; aksi: tugaskan owner (tetap/bergiliran), buat task, kirim notifikasi (`{{name}}` = nama record). Tiap kejadian dieksekusi sekali, ada batas per jam, dan semuanya tercatat di Log eksekusi. Butuh proses worker (`npm run worker`).

7. **WhatsApp** (Settings → Connectors → WhatsApp Business, Owner/Admin): hubungkan Fonnte atau gateway HTTP kustom, klik _Test Connection_, lalu salin **URL webhook** dan **secret** (tampil sekali) ke pengaturan gateway Anda. Pesan masuk muncul di **Inbox WhatsApp** (tertaut otomatis ke contact/lead lewat nomor telepon, dan tercatat di timeline). Tugaskan percakapan ke anggota tim (Sales Rep dapat _Ambil_ percakapan yang belum ditugaskan), tutup/buka kembali, atau _Buat lead_ dari nomor baru. Balasan terkirim **hanya** saat Anda menekan Kirim.

8. **Zapier / Make** (Settings → Connectors → "Zapier, Make & webhook keluar", Owner/Admin): tambahkan URL _Catch Hook_ (HTTPS), pilih event (lead/contact/deal/quotation), klik _Kirim uji_. Pengiriman bertanda tangan `X-CRM-Signature`, diulang otomatis bila gagal, dan tercatat di log.
9. **Google** (Settings → Integrasi Saya, tiap pengguna): hubungkan akun Google untuk menyinkronkan task/meeting/call berjadwal ke Google Calendar (dua arah) dan, opsional, mencatat email dengan contact CRM ke timeline (read-only). Server perlu `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (lihat `.env.example`).

10. **AI tambahan** (butuh AI connector): di quotation, _Buat draf dengan AI_ menulis pengantar/ruang lingkup — selalu draf yang Anda edit lalu _Simpan_; harga tidak pernah dibuat AI (peringatan muncul bila ada nominal). **Tanya CRM (AI)** menjawab pertanyaan seperti "Berapa deal Won bulan ini?" dengan kueri baca-saja; hasil hanya mencakup data yang boleh Anda lihat dan "cara pertanyaan dipahami" ditampilkan untuk diperiksa.

11. **Laporan lanjutan**: _Reports → Report Builder_ menyusun laporan sendiri (data, jumlah/total/daftar, kelompok, periode, filter), menyimpannya (pribadi atau organisasi), mengekspor CSV/XLSX, dan menjadwalkan pengiriman email harian/mingguan/bulanan ke anggota tim — tiap penerima hanya menerima data yang boleh ia lihat. **Segmen dinamis** (Customers → Segmen baru, Owner/Admin/Manager) mengelompokkan customer otomatis berdasarkan tag, total belanja, jumlah deal, dan recency; dapat dipakai sebagai filter dan di laporan "Segmen Pelanggan".

12. **Quotation lanjutan & aktivitas**: riwayat versi quotation dengan perbandingan dan pemulihan Draft; _Settings → Quotation_ dapat mengatur ambang approval (total ≥ ambang → ajukan persetujuan, disetujui Owner/Admin/Sales Manager sebelum dikirim). **Template aktivitas** (Settings, Owner/Admin/Manager) dipakai dari composer aktivitas (_Pakai template_). Di **Customers**, kartu _Peluang repeat purchase_ menampilkan customer yang perlu di-follow-up beserta tombol _Buat follow-up_.

13. **Fitur cerdas (Phase 3)** — semuanya hanya **memberi saran/informasi**, keputusan tetap di tangan Anda:
    - **Skor lead** (badge di daftar & rincian faktor di detail lead): Hot ≥ 70 / Warm 40–69 / Cold < 40 dari kelengkapan data, urgensi, interaksi, dan konversi historis sumber. Tidak mengubah status/penugasan.
    - **Asisten penjualan** di detail deal terbuka: estimasi peluang closing + saran stage (advance/stay/review) dengan akurasi backtest ditampilkan. Muncul setelah data deal tertutup memadai.
    - **Rekomendasi follow-up** (detail lead & Customer 360): kanal, waktu, dan draf dari pola interaksi; _Buat task follow-up_ menjadikannya task, _Tidak relevan_ hanya mencatat umpan balik.
    - **Intelligence** (`/intelligence`): kesiapan data per fitur, anomali otomatis (aktivitas customer VIP turun, win rate turun, lead baru turun; notifikasi in-app), akurasi prediksi, dan AI Draft Acceptance Rate.
    - **Forecast** (`/forecast`): rentang P10/P50/P90 untuk 3 bulan ke depan + backtest — _estimasi, bukan jaminan/akuntansi_.
    - **Inbox lintas kanal**: WhatsApp, email (dari sinkron Gmail), dan kanal lain yang dicatat manual dalam satu inbox; _Settings → Routing Inbox_ (Owner/Admin) mengatur penugasan otomatis (pemilik record / round robin). _Timeline komunikasi terpadu_ tampil di detail lead, contact, company, dan Customer 360.
    - **Webhook ERP/POS/akuntansi**: katalog 13 event dengan skema ber-versi di _Settings → Connectors_; pengiriman gagal masuk dead-letter dan dapat dikirim ulang. Lihat `docs/webhooks.md`.

## 2. Lead → Deal

- **Leads**: tambah manual, **Impor CSV** (pemetaan kolom, laporan baris error), atau **Dari teks (AI)** (tempel pesan WA/email → draf → periksa → Simpan). Form website masuk otomatis lewat webhook (sumber "Website").
- Ubah status (New → Contacted → Qualified/Unqualified; Unqualified wajib alasan). Sistem memperingatkan **duplikat** (tidak memblokir).
- **Konversi** lead Qualified menjadi contact/company/deal dalam satu langkah.

## 3. Deal & Kanban

- **Deals** → tab **Papan**: seret kartu antar stage (atau keyboard: Spasi, panah, Spasi). Riwayat stage tercatat.
- Tandai **Won** / **Lost** (Lost wajib alasan; kategori bisa dipilih atau diusulkan AI lalu Anda konfirmasi). Lencana risiko hanya informasi.
- Tambahkan **Produk** pada deal dari katalog (Products).

## 4. Aktivitas & kalender

- Di detail lead/contact/company/deal: catat call/meeting/email/catatan (editor teks), atau buat **task** dengan tenggat. **Asisten AI** meringkas coretan dan mengusulkan next activity (Anda yang mengonfirmasi). **Draf follow-up (AI)** memberi 3 opsi pesan + tombol Salin / Buka WhatsApp — tidak ada pengiriman otomatis.
- **Activities & Tasks**: tab Terlambat / Mendatang / Selesai. **Calendar**: tampilan bulan/minggu, filter pengguna. Reminder datang lewat **bell notifikasi** dan email (atur di Notifikasi → Preferensi).

## 5. Quotation

Quotations → **Quotation baru** (opsional dari deal: customer & produk disalin). Isi item dari katalog/kustom, diskon, lihat total real-time (dihitung ulang server saat Simpan). **Tandai terkirim** mengunci item; **Unduh PDF**. _Bukan sistem perpajakan/akuntansi._ Quotation yang kedaluwarsa otomatis berstatus Expired dan membuat task follow-up menjelang berakhir.

## 6. Customer

Customer muncul **otomatis** begitu sebuah deal berstatus **Won** (tidak perlu input manual). **Customer 360**: deal, quotation, aktivitas, feedback, segmen, jadwal follow-up/renewal, dan **Briefing AI** (total belanja dihitung sistem). Catat **Feedback/Complaint** di menu Customer Feedback.

## 7. Dashboard & laporan

- **Dashboard**: KPI, panel **Action Required**, grafik, performa sales & lead source; filter periode/tim/pengguna. Definisi tiap angka: `docs/metrics.md`.
- **Reports**: 8 laporan, export CSV/XLSX (Owner/Admin/Sales Manager). "Revenue" = nilai deal Won, **bukan** uang diterima/akuntansi.

## 8. Peran

| Peran | Ringkasan |
| --- | --- |
| Owner/Admin | Kelola semua (Admin tidak bisa menghapus organisasi) |
| Sales Manager | Lihat semua data; ubah milik sendiri & timnya; kelola pipeline/produk; laporan + export |
| Sales Rep | Lihat/ubah lead, deal, aktivitas, quotation **miliknya**; tidak bisa export |
| Viewer | Hanya lihat |
