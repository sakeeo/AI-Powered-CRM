# Product & Technical Decisions

Mengacu pada PRD §14.1. Status: **Diusulkan** = default sementara yang fleksibel, dapat diubah pemilik produk sebelum plan terkait dikerjakan.

| #   | Pertanyaan                                 | Keputusan                                                                         | Status    | Plan terkait |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------- | --------- | ------------ |
| 1   | Satu akun di beberapa organisasi?          | Ya (plugin Organization Better Auth).                                             | Diusulkan | 1.2          |
| 2   | Satu contact ke beberapa company?          | Ya, relasi eksplisit `contact_company`.                                           | Diusulkan | 1.5          |
| 3   | Deal dengan lebih dari satu contact?       | MVP: 1 contact utama + company; tabel relasi ditambah bila dibutuhkan.            | Diusulkan | 1.9          |
| 4   | Aturan merge duplikat?                     | Deteksi + merge manual oleh user; tanpa auto-merge.                               | Diusulkan | 1.7          |
| 5   | Beberapa pipeline per organisasi?          | Schema mendukung banyak pipeline; UI MVP cukup satu default.                      | Diusulkan | 1.9          |
| 6   | Definisi customer aktif/repeat?            | Customer = ≥1 deal Won; aktif/repeat didefinisikan di plan 1.16.                  | Diusulkan | 1.16         |
| 7   | Quotation perlu approval?                  | Tidak di MVP (plan 2.7).                                                          | Diusulkan | 2.7          |
| 8   | Retensi & penghapusan data?                | Soft delete (`deleted_at`) di MVP; kebijakan retensi final sebelum plan 1.20.     | Diusulkan | 1.20         |
| 9   | Default provider AI?                       | Gemini sebagai rekomendasi awal; semua provider tetap BYOK.                       | Diusulkan | 1.4          |
| 10  | Simpan log prompt/response AI?             | Tidak menyimpan isi; hanya metadata (fitur, waktu, status) hingga kebijakan privasi diputuskan. | Diusulkan | 1.4          |
| 11  | Definisi "customer"?                       | Turunan, bukan input manual: contact atau company dengan ≥1 deal berstatus Won (tertaut langsung pada deal). Status hilang bila semua deal Won dibuka kembali/dihapus. Nilai pembelian = jumlah nilai deal Won (Decimal, per mata uang). | Diputuskan | 1.16 |

## Keputusan Teknis (sudah ditetapkan)

| Topik          | Keputusan                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------ |
| Stack          | Next.js (App Router) + TypeScript, modular monolith.                                       |
| ORM            | Prisma 7 dengan driver adapter `@prisma/adapter-pg`; client di `src/generated/prisma`.     |
| Database dev   | PostgreSQL 16 via Docker Compose project ini, host port 5434 (container `crm-postgres`).   |
| Struktur kode  | `src/modules/<modul>/{components,server,schemas,types}`, kode bersama di `src/lib`.        |
| Environment    | Divalidasi Zod di `src/lib/env.ts`; contoh di `.env.example`.                              |
