# Panduan Pengguna (MVP)

Panduan singkat untuk alur kerja utama. Semua fitur AI hanya menghasilkan **draf** yang harus Anda periksa dan simpan sendiri.

## 1. Memulai

1. **Daftar** di halaman Sign up, lalu buat **organisasi** (nama, zona waktu, mata uang). Anda menjadi **Owner**.
2. **Undang tim**: Users & Teams → Undang (peran: Admin, Sales Manager, Sales Rep, Viewer). Undangan dikirim lewat email (butuh Email Delivery, langkah 3).
3. **Connectors** (Settings → Connectors): hubungkan **Email Delivery** (SMTP/Resend, klik _Kirim email uji_), **AI** (API key Anda sendiri — Gemini/OpenAI/Anthropic/OpenRouter), dan **Webhook** form website (salin URL & secret; secret hanya tampil sekali).
4. Atur **Lead Source**, **Pipeline** (stage & probabilitas), dan **Quotation** (pajak, masa berlaku) di Settings.
5. Sesuaikan data tanpa kode (Settings → **Tags** dan **Custom Fields**): tag berwarna untuk lead/contact/company/deal, dan isian tambahan (teks, angka, tanggal, ya/tidak, pilihan, URL) yang dapat wajib diisi, tampil di tabel, difilter, diimpor/diekspor, serta tampil hanya bila field lain bernilai tertentu (logika kondisional). Di tabel Leads/Contacts/Companies/Deals, **Simpan tampilan** menyimpan filter, pencarian, dan urutan (pribadi, tim, atau organisasi; bisa dijadikan bawaan ★).

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
