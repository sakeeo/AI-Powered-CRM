# Definisi Metrik Dashboard

Satu-satunya sumber definisi metrik. Kode: `src/modules/dashboard/server/metrics.ts`. Mengubah rumus **wajib** memperbarui dokumen ini di commit yang sama.

## Aturan umum

- **Izin**: semua angka dihitung hanya dari data yang boleh dilihat pengguna (`scopeWhere`): Sales Rep hanya data miliknya; Sales Manager/Admin/Owner/Viewer melihat seluruh data organisasi. Filter tim/pengguna **menyempit** di atas izin, tidak pernah memperluas.
- **Tenant**: semua query lewat `ctx.db` (terscope `organizationId`).
- **Periode** (`period`): `7d`, `30d` (default), `90d` = jendela bergulir berakhir _sekarang_; `mtd` = sejak tanggal 1 bulan berjalan 00:00 menurut zona waktu organisasi. Periode pembanding = jendela dengan panjang sama tepat sebelumnya.
- **Uang**: dijumlah dengan `Decimal`, **per mata uang** (tidak dikonversi). Ditampilkan `Rp … + $…` bila ada lebih dari satu mata uang.
- **Zona waktu**: "hari" (grafik lead per hari, batas "hari ini") mengikuti zona waktu organisasi.
- Record **terarsip** (lead) dan **terhapus** (deal, soft delete) tidak pernah dihitung.

## KPI (DASH-01…03)

| Metrik | Definisi |
| --- | --- |
| Total lead aktif | Jumlah lead dengan `archivedAt IS NULL` (semua status, semua waktu), sesuai izin & filter. |
| Lead baru (DASH-02) | Lead aktif dengan `createdAt` dalam periode. Tren = `(baru − pembanding) / pembanding × 100%` (disembunyikan bila pembanding 0). |
| Deal aktif | Deal `status = open`. |
| Nilai pipeline | Σ `value` deal `open`, per mata uang. |
| Nilai deal Won | Σ `value` deal `won` dengan `closedAt` dalam periode, per mata uang. |
| Customer | Jumlah contact + company yang punya ≥1 deal `won` yang boleh dilihat (definisi: `docs/decisions.md` #11). Tidak dipengaruhi periode. |
| Ringkasan pipeline (DASH-03) | Per stage aktif: jumlah deal `open` (+ total & nilai tertimbang probabilitas — lihat `pipelineSummary`). |

## Aktivitas (DASH-04…06)

| Metrik | Definisi |
| --- | --- |
| Terlambat | Aktivitas `status = open` dengan `dueAt < sekarang` (instan UTC; tenggat tanggal-saja = 23:59 zona organisasi). Menampilkan jumlah dan 5 tertua. |
| Mendatang | Aktivitas `open` dengan `dueAt ≥ sekarang`, 5 terdekat. |
| Terbaru | 6 aktivitas dengan `createdAt` terbaru (semua status). |

## Action Required (DASH-10)

| Kelompok | Definisi |
| --- | --- |
| Lead baru belum ditindaklanjuti | Lead aktif `status = new`, dibuat > 24 jam lalu, **tanpa satu pun aktivitas**. |
| Follow-up terlambat | Sama dengan "Terlambat" di atas. |
| Deal aktif tanpa next activity | Deal `open` yang tidak punya aktivitas `status = open`. |
| Quotation perlu tindak lanjut | Quotation `sent` dengan `validUntil ≤ hari ini + 3 hari` (termasuk yang sudah lewat tetapi belum diproses worker). |

## Performa (DASH-07, DASH-08)

| Metrik | Definisi |
| --- | --- |
| Performa sales (per pemilik) | Won = jumlah & nilai deal `won` dengan `closedAt` dalam periode; Deal terbuka = deal `open` saat ini; Lead baru = lead dibuat dalam periode. Baris "Belum ditugaskan" untuk `ownerId` kosong. |
| Performa lead source | **Cohort**: lead yang dibuat dalam periode, dikelompokkan per sumber. Konversi = lead dengan `convertedAt` terisi ÷ lead cohort tersebut × 100% (satu desimal). Pembagi = jumlah lead cohort sumber itu. |
| Lead baru per hari | Jumlah lead dibuat per tanggal (zona organisasi); hari tanpa lead bernilai 0. |

## Performa query

Agregasi memakai `count`/`groupBy` di database (bukan memuat seluruh baris), didukung indeks: `leads(organization_id, status)`, `leads(organization_id, created_at desc)`, `leads(organization_id, owner_id)`, `deals(organization_id, status, stage_id)`, `deals(organization_id, owner_id)`, `activities(organization_id, status, due_at)`, `activities(organization_id, owner_id, status)`, `quotations(organization_id, status, valid_until)`. Pengecualian: seri harian & konversi per sumber membaca maksimal 10.000 lead dalam periode (hanya kolom tanggal/sumber).

## Laporan (halaman Reports, plan 1.18)

Semua laporan memakai `resolveFilters` yang sama dengan dashboard (periode, tim, pengguna) dan izin yang sama, sehingga angkanya konsisten dengan KPI dashboard (diuji di `tests/integration/reports.test.ts`).

| Laporan | Definisi |
| --- | --- |
| Lead | Lead dibuat pada periode, per status; persentase = jumlah status ÷ total lead periode. |
| Pipeline | Deal `open` saat ini per stage: jumlah, total nilai, nilai tertimbang probabilitas (nilai × probabilitas deal ?? stage ÷ 100). |
| Won/Lost | Deal ditutup (`closedAt`) pada periode. Win rate = Won ÷ (Won + Lost). Alasan Lost per kategori (kategori ditetapkan user; usulan AI tidak otomatis final); kategori kosong = "Belum dikategorikan". |
| Conversion | Cohort = lead dibuat pada periode. Funnel: dibuat → Qualified (atau sudah dikonversi) → dikonversi → deal Won; persentase terhadap lead dibuat. |
| Lead Source | Cohort sama; per sumber: lead, terkonversi, konversi %, deal Won dari lead tersebut. |
| Sales Performance | Per pemilik: lead baru, Won, nilai Won, Lost, win rate, deal terbuka (saat ini), aktivitas selesai (`completedAt` pada periode). |
| Activity | Aktivitas dibuat pada periode per jenis; tingkat selesai = Selesai ÷ Dibuat; Terlambat = masih `open` dan lewat tenggat. |
| Revenue | Σ nilai deal **Won** per bulan (zona waktu organisasi) per mata uang. **Bukan** cash received maupun pendapatan akuntansi. |
