# Design System

> **Satu-satunya referensi desain UI/UX untuk frontend aplikasi ini.**
> Sumber visual: [`mockup-dasboard.html`](mockup-dasboard.html) (Admin Dashboard). Dokumen ini adalah terjemahan mockup tersebut menjadi token, komponen, dan aturan. Bila ada konflik antara dokumen ini dan mockup, **mockup menang** — lalu perbarui dokumen ini.

## 0. Aturan Wajib

1. Semua UI baru **harus** mengikuti dokumen ini dan mockup. Jangan memakai referensi desain lain (template shadcn bawaan, contoh dari internet, gaya pribadi).
2. **Tidak ada nilai hardcode** (hex, px warna, shadow) di komponen/halaman. Gunakan token di [`src/app/globals.css`](../src/app/globals.css) lewat kelas Tailwind (`bg-primary`, `text-muted-foreground`, `bg-tone-green-soft`, `shadow-card`, …).
3. Warna berarti sesuatu (lihat §2.3). Jangan memilih warna karena "kelihatan bagus".
4. Gunakan komponen dari `src/components/ui` (primitif shadcn) dan `src/components/shared` (pola mockup) sebelum membuat yang baru. Pola baru yang dipakai ≥2 tempat → tambahkan ke `shared/` **dan** dokumentasikan di §5.
5. Ikon: hanya `lucide-react`, stroke 1.8 (default 2 diterima), tanpa emoji dan tanpa karakter unicode sebagai ikon (mockup memakai emoji hanya sebagai placeholder).
6. Setiap perubahan visual yang disengaja pada mockup harus ikut memperbarui dokumen ini di commit yang sama.

## 1. Karakter Visual

Bersih, terang, profesional. Latar abu kebiruan sangat muda; kartu putih berborder tipis dengan bayangan lembut; satu warna merek biru (`#1269a8`) sebagai jangkar; warna tambahan (hijau, oranye, ungu, merah) **hanya** sebagai penanda kategori/status dalam bentuk _tint_ lembut. Elemen "hero" dan aksi cepat boleh memakai gradien penuh — gradien tidak dipakai di tempat lain.

## 2. Token

### 2.1 Warna dasar (light — referensi utama)

| Token (Tailwind)                     | Nilai     | Mockup        | Pakai untuk                         |
| ------------------------------------ | --------- | ------------- | ----------------------------------- |
| `primary`                            | `#1269a8` | `--blue`      | Aksi utama, tab aktif, link, fokus  |
| `primary-strong` (`--brand-strong`)  | `#0d5b96` | `--blue2`     | Hover aksi utama, ujung gradien     |
| `brand-navy`                         | `#104f80` | `--navy`      | Ujung gradien gelap, teks di tint biru |
| `foreground`                         | `#172033` | `--ink`       | Teks utama                          |
| `muted-foreground`                   | `#7d8796` | `--muted`     | Teks sekunder, label, subjudul      |
| `border`                             | `#e8edf3` | `--line`      | Border kartu, pemisah, topbar       |
| `background`                         | `#f6f8fb` | `--bg`        | Latar halaman                       |
| `card`                               | `#ffffff` | `#fff`        | Kartu, panel, popover               |
| `muted`                              | `#f0f2f5` | `#f0f2f5`     | Track bar/progress, latar input     |
| `input`                              | `#e2e7ed` | `#e2e7ed`     | Border kontrol (tab, input)         |
| `destructive`                        | `#ef3c4b` | `--red`       | Aksi berbahaya, error               |

### 2.2 Sidebar

| Token                      | Nilai                                | Catatan                         |
| -------------------------- | ------------------------------------ | ------------------------------- |
| `--sidebar-gradient`       | `linear-gradient(180deg,#126baa,#105b94)` | Latar sidebar (vertikal)   |
| `sidebar-foreground`       | `#e3f1fb`                            | Teks/ikon menu                  |
| `sidebar-accent`           | `#3485f6` (teks putih)               | Menu aktif **dan** hover        |
| `sidebar-border`           | `rgba(255,255,255,.15)`              | Pemisah brand / user            |
| subtitle brand             | `#c8e2f5`                            | "Admin Panel"-style caption     |

Sidebar **selalu biru** di light maupun dark mode (identitas merek).

### 2.3 Tone (warna semantik kategori/status)

Lima tone. Tiap tone punya `solid` (ikon penuh, tombol, badge angka), `soft` (latar tint), `border` (tepi kartu berwarna), dan `ink` (teks di atas soft).

| Tone     | solid     | soft      | border    | ink       | Makna                                             |
| -------- | --------- | --------- | --------- | --------- | ------------------------------------------------- |
| `blue`   | `#1269a8` | `#eff6ff` | `#c9e0ff` | `#1670b5` | Netral/informasi, data utama (user, lead)         |
| `green`  | `#0eaa7c` | `#ecfbf4` | `#bfeedd` | `#0c9d72` | Positif: naik, sukses, won, live, uang masuk      |
| `orange` | `#f47708` | `#fff8e9` | `#ffdfb8` | `#b45f06` | Perhatian: pending, perlu tindakan, belum selesai |
| `purple` | `#913ce8` | `#f6f0ff` | `#e2cdfb` | `#7a2fd0` | Kategori ke-4, nilai/revenue, pelengkap           |
| `red`    | `#ef3342` | `#fff0f1` | `#ffd1d5` | `#d92a39` | Negatif: turun, gagal, overdue, urgent            |

Kelas Tailwind: `bg-tone-{tone}`, `bg-tone-{tone}-soft`, `border-tone-{tone}-border`, `text-tone-{tone}-ink`.
Jangan mengubah makna: **tren naik = green, turun = red** (selalu disertai ikon panah, jangan hanya warna).

Gradien aksi cepat / hero (`--gradient-*`):

| Nama                | Gradien                                 |
| ------------------- | --------------------------------------- |
| `hero`              | `110deg, #176eae → #0e4e7d`             |
| `quick-blue`        | `120deg, #176fae → #0e5790`             |
| `quick-green`       | `120deg, #0dbb8a → #079b88`             |
| `quick-orange`      | `120deg, #ff9b00 → #f0520a`             |
| `quick-purple`      | `120deg, #994af3 → #7c1ce4`             |
| `medal-gold/silver/bronze` | `135deg, #ffc400→#e89a00` / `#c9d4df→#77889b` / `#ff9c21→#f45c45` |

Seri grafik: `chart-1…5` = blue `#1269a8`, green `#0eaa7c`, orange `#f47708`, purple `#913ce8`, red `#ef3342` (urutan ini dipertahankan).

### 2.4 Dark mode (turunan — tidak ada di mockup)

Mockup hanya light. Dark mode **diturunkan** dari hue yang sama dan tidak boleh memperkenalkan hue baru:
`background #0e1522`, `card #151f30`, `border` putih 10%, `foreground #e6edf6`, `muted-foreground #94a1b3`, `primary #4a9ad8`, soft tone = solid tone pada opasitas 15% di atas card. Gradien hero/aksi cepat/sidebar tetap sama. Bila mockup dark resmi dibuat, ia menggantikan bagian ini.

### 2.5 Tipografi

Font: **Inter** (`--font-sans`), fallback `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Mono: Geist Mono (kode, ID). Line-height dasar 1.5. `tabular-nums` untuk semua angka di tabel/KPI.

Skala (mockup, setelah blok "typography scale"):

| Peran                      | Ukuran | Weight | Letter-spacing | Kelas                              |
| -------------------------- | ------ | ------ | -------------- | ---------------------------------- |
| Hero heading (welcome)     | 28px (25 <900px, 23 <600px) | 750 | -0.6px | `text-hero`           |
| KPI besar (kartu metrik)   | 27px (24 <900px, 22 <600px) | 700 | -0.5px | `text-kpi`            |
| KPI hero-stat              | 24px (22 <900px)            | 700 | 0      | `text-kpi-sm`         |
| Judul halaman (topbar)     | 21px (19 <600px)            | 750 | -0.5px | `text-page-title`     |
| Judul panel (`h3`)         | 17px (16 <600px)            | 650 | -0.2px | `text-panel-title`    |
| Judul kartu pending        | 15px                        | 650 | 0      | `text-md font-semibold`|
| Body / menu / tabel        | 14px                        | 400–500 | 0 | `text-sm` (default body)   |
| Body kecil / label         | 13px                        | 400–600 | 0 | `text-label`|
| Meta / caption / subjudul  | 12px                        | 400    | 0              | `text-xs`                          |
| Micro (footer metrik, tertiary) | 11px — **minimum mutlak** | 400–600 | 0 | `text-micro`           |

Tidak ada teks di bawah 11px (mockup awal memakai 9–10px; versi final menaikkannya — jangan kembali).

### 2.6 Spasi, radius, bayangan

- Spasi basis 4px. Padding kartu 17px (14px di ≤600px) lewat token `p-card`; jarak antar kartu 14–16px (`gap-3.5`/`gap-4`); padding halaman 24px (`lg:p-6`), menyusut ke 16px dan 12px di layar lebih kecil.
- Radius: kontrol/menu 9px (`rounded-md`), tile/tab/seller 10–12px (`rounded-lg`), kartu 15px (`rounded-xl`), hero 18px (`rounded-2xl`), pil/badge `rounded-full`.
- Bayangan kartu `shadow-card` = `0 2px 8px rgba(18,39,66,.06), 0 1px 2px rgba(18,39,66,.05)`. Hero: `shadow-hero` = `0 12px 24px rgba(18,79,128,.125)`. Tidak ada bayangan lain; popover memakai `shadow-md` bawaan.
- Transisi: 150ms (hover `translateY(-2px)` hanya untuk tile aksi cepat), bar/progress 350ms ease. Hormati `prefers-reduced-motion`.

## 3. Layout & Responsif

```
┌─────────┬──────────────────────────────────────────────┐
│ Sidebar │ Topbar (64px, sticky, blur putih 85%)        │
│ 220px   ├──────────────────────────────────────────────┤
│ biru    │ Konten: padding 24px                          │
│ fixed   │  Hero → Metrik (4 kol) → Konten (1.65fr/.8fr)  │
│         │  → Lower (2 kol) → Pending (3 kol)            │
└─────────┴──────────────────────────────────────────────┘
```

| Breakpoint | Perilaku (dari mockup)                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| >1050px    | Sidebar 220px (label + ikon). Metrik 4 kolom. Konten 2 kolom 1.65fr/.8fr.                   |
| ≤1050px    | Sidebar 190px, padding halaman 17px, grid konten 1.4fr/.8fr.                                |
| ≤780px     | Metrik & hero-stat 2 kolom; konten, lower, pending → 1 kolom; sidebar menyempit jadi ikon 65px di mockup. |
| ≤480px     | Search disembunyikan, topbar 58px, hero-stat/metrik padding lebih rapat, summary 2 kolom.   |

**Penyesuaian aplikasi (sengaja, terdokumentasi):** pada ≤768px sidebar menjadi _drawer_ (bukan strip ikon 65px) karena aplikasi punya 13 menu dan menu harus dapat dibaca; strip ikon tetap dipakai sebagai mode _collapsed_ di desktop. Lebar sidebar 220px.

Tidak boleh ada scroll horizontal di lebar 375px (diuji di `e2e/responsive.spec.ts`).

## 4. Anatomi Shell

- **Sidebar**: brand (nama 17px/700 + caption 12px `#c8e2f5`, pemisah bawah), grup menu `gap-1.5`, item `h-10` `px-3` `rounded-md` `text-sm`, ikon 17px. Aktif/hover → `sidebar-accent` + teks putih. Footer: avatar bulat 34px `#e7f1fb` teks `primary` weight 800 + nama (13px) + email (11px `#c5dced`), pemisah atas.
- **Topbar**: tinggi 64px, `bg-card/85` + `backdrop-blur`, border bawah. Kiri: `h1` judul halaman (21px) + subjudul 12px muted (dari `nav.ts`). Kanan: pencarian (220px, `muted`, radius 9px, ikon search) → notifikasi → avatar-dot 27px `#1765e9` → chevron.
- **Konten**: `bg-background`, `p-6` (menyusut sesuai breakpoint). Satu `h1` per halaman (di topbar); judul dalam konten adalah `h2`/`h3`.

## 5. Pola Komponen

Semua ada di `src/components/shared/` kecuali dinyatakan lain.

| Pola              | Komponen              | Aturan inti                                                                                              |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Kartu / Panel     | `ui/card` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`) | `rounded-xl border bg-card shadow-card`. Header: judul 17px + deskripsi 12px muted + aksi di kanan. |
| Hero banner       | `HeroBanner`, `HeroStat` | Gradien `hero`, radius 18, dua lingkaran dekoratif, teks putih; stat = kaca (`white/10`, border `white/17`). Maks 1 per halaman, hanya di dashboard/landing modul. |
| Kartu metrik (KPI)| `StatCard`            | Ikon tile 36px (tone soft) + `TrendBadge` kanan atas; angka 27px; label 13px; sub 12px; progress 5px; footer "vs bulan lalu". |
| Badge tren        | `TrendBadge`          | Pil, 12px/650, tone green (naik) / red (turun) + panah. Tidak pernah hanya warna.                         |
| Progress          | `ProgressBar`         | Track `muted` 5px, isi tone solid, radius penuh.                                                         |
| Ikon tile         | `IconTile`            | Kotak rounded 10px, latar tone soft, ikon tone ink. Ukuran 27 / 36.                                       |
| Tab segmen        | `ui/tabs` → `<TabsList variant="segment">` | Tombol 12px, border `input`, radius 8; aktif = `primary` + teks putih + bayangan biru tipis.     |
| Aksi cepat        | `QuickAction`         | Tile gradien 88px, radius 12, ikon 19px, judul 13px/700, sub 11px (opasitas .82), lingkaran dekoratif, hover naik 2px. |
| Kartu pending     | `PendingCard`         | Latar tone soft + border tone border, ikon tile solid, pil jumlah solid, judul 15px, deskripsi 13px, tombol penuh tone solid. |
| Daftar aktivitas  | pola `ActivityItem` (dibuat di fitur) | Ikon tile 27px tone bergilir, teks 12px (nama tebal), nominal hijau 12px/700, waktu 11px muted, pemisah `border`. Indikator "Live": titik hijau 6px + 11px/700. |
| Peringkat         | pola `RankRow`        | Baris `#fafbfd` radius 11, badge medali 39px gradien + angka rank di pin putih 16px, nama 13px/600, meta 11px, nominal 13px/700 kanan. |
| Tombol            | `ui/button`           | Radius 9. `default` = primary biru solid; `outline` = border `input` putih; `ghost`; `destructive`. Di atas hero: `HeroButton` (outline putih: `white/8` + border `white/28`). Tinggi: `default` 36px, `lg` 40px (aksi utama di form/halaman), `sm` 32px (aksi di baris tabel/hero). |
| Input             | `ui/input`, `ui/input-group` | Tinggi 36px, latar `card`, border `input`, radius 9, teks 14px, fokus ring `primary`/50.            |
| Pencarian topbar  | `CommandPalette`      | Latar `muted`, border `border`, lebar 220px, radius 9, teks 13px, hint `Ctrl K`; hanya ikon di mobile.   |
| Tabel (data padat)| `ui/table`            | Header 12px/600 `muted-foreground` (tanpa uppercase); baris 14px, tinggi 44px, pemisah `border`, hover `accent`. Angka rata kanan `tabular-nums`. Dibungkus `Card` tanpa padding. |
| Empty state       | `EmptyState`          | Border putus-putus, ikon dalam lingkaran `muted`, judul 14px/600, deskripsi 13px muted.                  |
| Toast             | `sonner`              | `richColors`; sukses green, error red.                                                                  |

Densitas data tinggi (PRD §10.2): untuk tabel/daftar panjang pakai baris 44px dan teks 14px — jangan menambah padding mockup.

## 6. Interaksi & Aksesibilitas

- Fokus terlihat: ring 3px `primary/50` pada semua kontrol; jangan `outline-none` tanpa pengganti.
- Target sentuh ≥ 36px (≥ 44px pada ≤480px untuk tombol utama).
- Kontras: teks 14px+ ≥ 4.5:1. Catatan: `muted-foreground #7d8796` di atas putih ≈ 3.7:1 — **hanya** untuk teks sekunder ≥12px non-esensial; informasi penting memakai `foreground` atau tone `ink`.
- Status tidak boleh hanya warna: sertakan ikon atau teks (panah tren, label status).
- Hormati `prefers-reduced-motion` dan `prefers-color-scheme` (via `next-themes`).
- Semua ikon-saja punya `aria-label`.

## 7. Bahasa & Konten

UI berbahasa Indonesia. Format uang `Rp 84 jt` / `Rp 2,4 M` pada KPI ringkas dan `Rp 4.500.000` pada tabel (`Intl.NumberFormat("id-ID")`). Tanggal `Rabu, 1 April 2026` (hero) dan `1 Apr 2026` (tabel) lewat `date-fns/locale/id`. Mockup memakai PKR/Inggris hanya sebagai data contoh.

## 8. Pemetaan Mockup → Aplikasi CRM

| Mockup                          | Padanan di CRM                                              |
| ------------------------------- | ----------------------------------------------------------- |
| Welcome hero + 4 hero-stat      | Sapaan + Lead hari ini, Deal baru, Revenue hari ini, Conversion |
| 4 kartu metrik                  | Total Lead, Deal aktif, Deal Won (bulan ini), Revenue      |
| Revenue Analytics (bar bulanan) | Revenue per bulan / kuartal (Reports)                       |
| Live Activity                   | Aktivitas terbaru (lead masuk, deal pindah stage, quotation) |
| Quick Actions                   | Tambah Lead, Buat Deal, Buat Quotation, Jadwalkan Aktivitas |
| Top Sellers                     | Top Sales (peringkat per revenue)                           |
| Pending Actions                 | Follow-up overdue, Quotation menunggu, Complaint terbuka    |

## 9. Checklist Review UI

- [ ] Hanya token (tidak ada hex/px warna/shadow baru)?
- [ ] Tone dipakai sesuai makna §2.3?
- [ ] Ukuran teks sesuai skala §2.5, tidak ada < 11px?
- [ ] Tampil benar di 375 / 768 / 1440 tanpa scroll horizontal?
- [ ] Fokus keyboard terlihat, ikon-saja berlabel, status tidak hanya warna?
- [ ] Light dan dark sama-sama terbaca?
- [ ] Pola baru sudah didokumentasikan di §5?
