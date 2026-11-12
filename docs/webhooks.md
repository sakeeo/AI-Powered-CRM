# Webhook keluar untuk ERP / POS / Akuntansi (plan 3.7)

Event bisnis diteruskan ke endpoint HTTPS milik tenant secara andal: ditandatangani, di-retry, dan dicatat (dead-letter
yang dapat dikirim ulang). Kelola endpoint di **Settings → Connectors → Webhook keluar**; katalog event ditampilkan di
halaman yang sama. Sumber kebenaran katalog & skema: `src/modules/integrations/events.ts`.

## Amplop & header

```json
{
  "id": "5b0c…-uuid",
  "event": "deal.won",
  "schemaVersion": "1",
  "createdAt": "2026-11-12T08:00:00.000Z",
  "data": { "…": "payload khusus event" }
}
```

| Header                 | Isi                                                             |
| ---------------------- | --------------------------------------------------------------- |
| `X-CRM-Event`          | nama event                                                      |
| `X-CRM-Schema-Version` | versi skema payload (saat ini `1`)                              |
| `X-CRM-Delivery`       | ID pengiriman (stabil saat dikirim ulang → untuk deduplikasi)   |
| `X-CRM-Timestamp`      | detik epoch saat penandatanganan                                |
| `X-CRM-Signature`      | `sha256=` + HMAC-SHA256(secret, `"<timestamp>.<body mentah>"`)  |

Verifikasi di penerima: hitung HMAC atas `timestamp + "." + body mentah`, bandingkan dengan konstan-waktu, dan tolak bila
timestamp terlalu lama (mis. > 5 menit). Secret tampil sekali saat dibuat/diputar.

## Katalog event (skema v1)

Uang = string desimal (`"1500000.00"`), tanggal = ISO 8601, ID = string. Catatan internal & alasan Lost bebas **tidak**
pernah ikut (whitelist field).

| Event                | Kategori        | Kapan                                                   | `data`                                                                                     |
| -------------------- | --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `lead.created`       | CRM             | Lead baru                                               | id, name, email, phone, companyName, status, sourceId, ownerId, budget, currency, customFields, createdAt |
| `lead.converted`     | CRM             | Lead dikonversi                                         | field lead + contactId, companyId, dealId                                                  |
| `contact.created`    | CRM             | Contact baru                                            | id, name, email, phone, jobTitle, ownerId, customFields, createdAt                         |
| `deal.created`       | Penjualan       | Deal baru                                               | id, title, status, value, currency, stageId, contactId, companyId, ownerId, closedAt, lostCategory, customFields |
| `deal.stage_changed` | Penjualan       | Deal terbuka pindah stage                               | field deal + fromStageId, toStageId                                                        |
| `deal.won`           | ERP/Akuntansi   | Deal Won → sales order/invoice                          | field deal                                                                                 |
| `deal.lost`          | Penjualan       | Deal Lost                                               | field deal (+ lostCategory baku)                                                           |
| `customer.created`   | ERP/Akuntansi   | Deal Won pertama suatu company (atau contact tanpa company) | partyType, partyId, firstDealId, firstDealValue, currency, wonAt                       |
| `quotation.sent`     | Penjualan       | Quotation terkirim                                      | id, number, status, total, currency, validUntil, dealId, contactId, companyId, ownerId     |
| `quotation.accepted` | ERP/Akuntansi   | Pelanggan menyetujui quotation                          | (sama dengan quotation.sent)                                                               |
| `quotation.rejected` | Penjualan       | Pelanggan menolak quotation                             | (sama)                                                                                     |
| `product.created`    | POS/Katalog     | Produk baru                                             | id, name, sku, price, currency, isActive, categoryId                                       |
| `product.updated`    | POS/Katalog     | Produk diubah / diaktifkan / dinonaktifkan              | (sama)                                                                                     |

**Versioning**: perubahan tidak kompatibel (hapus/ubah tipe field) = `schemaVersion` baru; penambahan field opsional tetap
di versi yang sama — consumer harus mengabaikan field yang tidak dikenal. Payload divalidasi terhadap skema sebelum
diantre; yang melanggar kontrak **tidak dikirim** dan dicatat di log server (kesalahan pemrogram).

## Keandalan

- **Idempoten**: unik `(endpoint, eventId)`; ID event deterministik per kejadian (mis. `customer.created:company:<id>`).
- **Retry**: antrean BullMQ, 5 percobaan, backoff exponential mulai 10 dtk. Timeout 10 dtk, redirect ditolak.
- **Dead-letter**: setelah percobaan terakhir gagal (atau tujuan tak valid), status `failed` — tampil di "Pengiriman
  terakhir" sebagai _Dead-letter_ dengan galat & HTTP status. Pengguna dengan izin kelola connector dapat **Kirim ulang**
  (hanya status gagal, endpoint harus aktif; teraudit `outbound_delivery.retried`).
- **Keamanan**: URL wajib HTTPS & IP publik (anti-SSRF, divalidasi ulang tiap kirim); secret terenkripsi per tenant.
- **Audit**: setiap pembuatan/ubah/putar secret/hapus/kirim ulang endpoint tercatat di Audit Log; setiap pengiriman
  tersimpan (status, percobaan, HTTP, galat).

## Batasan

- Event dikirim _at-least-once_ — penerima wajib idempoten (`X-CRM-Delivery` / `id`).
- Urutan antar event tidak dijamin (retry dapat mengubah urutan).
- Belum diuji terhadap ERP/POS sungguhan (butuh endpoint); alur diuji dengan mock `fetch`.
