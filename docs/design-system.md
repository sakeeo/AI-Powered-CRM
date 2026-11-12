# Design System

> **Satu-satunya referensi desain tampilan untuk frontend aplikasi ini: template [`spike-tailwind/`](spike-tailwind/)** (Spike / Modernize Tailwind Admin Template) — **dengan palet warna proyek** (§2.0: krem / hijau tua / merah-oranye, aturan 60/30/10).
> Pembagian peran: **template = struktur** (layout, komponen, radius, bayangan, tipografi, spasi, responsif); **palet proyek = seluruh warna**. Sumber template: `spike-tailwind/package/src` (HTML + `tailwind.config.js`) dan `spike-tailwind/dist` (buka `dist/index.html`). Bila template dan dokumen ini bertentangan soal **struktur**, template menang; soal **warna**, §2.0 menang. Perbarui dokumen ini di commit yang sama dengan perubahan UI.
>
> Menggantikan mockup lama (`mockup-dasboard.html`, biru `#1269a8`, hero/quick-action). Mockup itu **tidak lagi menjadi acuan**.

## 0. Aturan Wajib

1. **Template dulu, komponen baru belakangan.** Sebelum membuat komponen/pola UI, cari padanannya di template (`package/src/components/*.html`, `package/src/pages/*.html`, `package/src/partials/*`). Bila ada → tiru strukturnya (kelas, spasi, radius; **warna lewat token palet §2.0**, bukan warna bawaan template) dan bungkus sebagai komponen React. Komponen baru hanya boleh dibuat bila **tidak ada** padanan di template; tuliskan alasannya di §6.
2. Jangan memakai referensi desain lain (default shadcn, contoh internet, gaya pribadi, mockup lama).
3. **Tidak ada nilai hardcode** (hex, px warna, shadow) di komponen/halaman. Semua nilai (warna palet proyek, radius/bayangan template) didaftarkan sebagai token di [`src/app/globals.css`](../src/app/globals.css) dan dipakai lewat kelas Tailwind (`bg-primary`, `text-muted-foreground`, `rounded-md`, `shadow-card`, …).
4. Pakai primitif `src/components/ui` (shadcn/Radix — perilaku & aksesibilitas) dan pola `src/components/shared`, tetapi **tampilannya mengikuti template**, bukan default shadcn. Template memakai Preline (JS dropdown/overlay/accordion) — di aplikasi ini padanannya adalah Radix/shadcn (`dropdown-menu`, `sheet`, `dialog`); jangan menambah Preline/jQuery/SimpleBar.
5. Ikon: template memakai **Tabler Icons** (`ti ti-*`). Aplikasi tetap memakai `lucide-react` dengan padanan terdekat (ukuran template: menu 24px, header 20–24px). Tanpa emoji / karakter unicode sebagai ikon.
6. Pola baru yang dipakai ≥2 tempat → komponen `shared/` **dan** dokumentasikan di §6.

## 1. Karakter Visual

Hangat, lembut, membulat. Latar halaman krem; blok konten (header, kartu) adalah **panel krem terang mengambang** dengan radius besar dan bayangan tipis; sidebar adalah **panel hijau tua mengambang** (bukan penuh-tinggi). Warna merek **hijau tua**; satu aksen **merah-oranye** dipakai hemat untuk perhatian/bahaya. Tombol berbentuk **kapsul** (radius 30px). Teks hijau-hitam hangat, bukan hitam murni. Tidak ada gradien.

## 2. Token

Struktur token (radius, bayangan, tipografi, spasi) mengikuti `spike-tailwind/package/tailwind.config.js`; **nilai warna mengikuti palet proyek di bawah**. Semua terdaftar di `src/app/globals.css`.

### 2.0 Palet proyek — aturan 60/30/10

| Porsi | Peran | HEX | Token |
| ----- | ----- | --- | ----- |
| **60% Main** | Krem hangat: latar halaman; kartu/panel sedikit lebih terang | `#efece6` (kartu `#faf8f4`) | `background`, `card`, `popover` |
| **30% Second** | Hijau tua: aksi utama, link, tab/menu aktif, ring fokus, sidebar | `#1d4631` (hover/gelap `#173d2b`) | `primary`, `primary-strong`, `sidebar`, `brand-navy` |
| **10% Loud** | Merah-oranye terang: aksen, aksi berbahaya, indikator sidebar | `#ff4b26` | `destructive`, `tone-red`, `sidebar-primary` |

Aturan pakai: Loud ≤ 10% permukaan — **bukan** warna tombol utama; Second untuk semua aksi utama; Main untuk semua permukaan netral.

### 2.1 Peta peran template → token palet

Kolom "template" adalah peran yang dipakai HTML/kelas template (`blue-600`, `teal-500`, …). Kelas itu **tidak dipakai langsung**; pakai token di kolom kanan.

| Peran (kelas template)                  | Token CRM (kelas Tailwind)                 | Nilai light | Nilai dark |
| --------------------------------------- | ------------------------------------------ | ----------- | ---------- |
| Primary / tombol utama (`blue-600`)     | `primary` (`bg-primary`, `text-primary`)   | `#1d4631`   | `#5fb383`  |
| Primary hover (`blue-700`)              | `primary-strong`                           | `#173d2b`   | `#7cc79c`  |
| Tint primary: menu aktif/hover, alert primary (`blue-500`) | `secondary`, `accent` (`bg-secondary`) | `#e1e8e1` | `#1f3427` |
| Teks di atas tint primary (`#006aaf`)   | `secondary-foreground`, `accent-foreground`| `#173d2b`   | `#d3e6da`  |
| Success (`teal-*`)                      | `tone-green*`                              | `#4f9a6e`, tint `#e3f1e8`, ink `#2c7048` | `#6fc48a` |
| Warning (`yellow-*`)                    | `tone-orange*`                             | `#e0a030`, tint `#fbf1dc`, ink `#8a6010` | `#e8b04a` |
| Danger (`red-*`)                        | `destructive`, `tone-red*`                 | `#ff4b26`, tint `#ffe9e3`, ink `#c22a08` | `#ff6a47` |
| Info (`blue-300/400/200`)               | `tone-purple*`                             | `#5b8f9a`, tint `#e2edef`, ink `#3a6873` | `#7fb0bb` |
| Teks utama/judul (`gray-500`)           | `foreground`                               | `#17231c`   | `#ece9e2`  |
| Teks sekunder/label (`gray-400`)        | `muted-foreground`                         | `#666b63`   | `#9aa89f`  |
| Border & input (`gray-100/200`)         | `border`, `input`                          | `#dcd7cc` / `#d5d0c4` | putih 10–15% |
| Latar halaman (`surface`)               | `background`                               | `#efece6`   | `#0f1a14`  |
| Kartu/panel/popover (`white`)           | `card`, `popover`                          | `#faf8f4`   | `#16251c`  |
| Chip/disabled/track (`gray-200`)        | `muted`                                    | `#e4e0d7`   | `#1c2b22`  |
| Sidebar: latar / teks / label grup      | `sidebar` / `sidebar-foreground` / `sidebar-muted` | `#1d4631` / `#efece6` / `#a9bfb0` | `#0c1f16` / `#ece9e2` / `#8fa699` |
| Sidebar: hover & aktif (sapuan pil)     | `sidebar-accent` + `sidebar-accent-foreground` | `#2b5a41` + putih | `#1d4631` + putih |
| Sidebar: indikator/aksen                | `sidebar-primary`, `sidebar-ring`          | `#ff4b26`   | `#ff6a47`  |
| Seri grafik 1–5                         | `chart-1…5`                                | hijau tua, hijau, kuning, teal, merah-oranye | — |

**Makna warna:** hijau tua = utama/netral; hijau = sukses/naik; kuning = peringatan/pending; merah-oranye = bahaya/turun/gagal; teal = informasi. Tren naik = success, turun = danger, selalu disertai ikon/teks. Teks error memakai `tone-red-ink` (merah-oranye murni hanya untuk isian/ikon/tombol, kontras di atas krem rendah).

### 2.2 Tipografi

Font: **Plus Jakarta Sans** 400/500/600/700 (`--font-sans`; ganti Inter). Mono: Geist Mono (kode/ID). Template memakai skala Tailwind standar:

| Peran                           | Kelas template                          |
| ------------------------------- | --------------------------------------- |
| Judul kartu/seksi               | `text-lg font-semibold text-gray-500` (→ `text-lg font-semibold text-foreground`) |
| Judul statistik/angka besar     | `text-[22px] font-semibold`             |
| Sub-judul kartu                 | `text-base font-semibold`               |
| Body, tabel, form, alert        | `text-sm`                               |
| Menu sidebar                    | `text-base` (ikon `text-2xl`)           |
| Label grup menu                 | `text-xs font-semibold` uppercase, `gray-400` |
| Label form                      | `text-sm text-gray-400`, `mb-2`         |
| Caption / meta                  | `text-sm text-gray-400` (opacity 75–80) |
| Heading konten (typography.html)| `text-2xl/3xl/4xl`                      |

Angka di tabel/KPI memakai `tabular-nums`. Tidak ada teks di bawah 12px.

### 2.3 Radius (override template — penting)

| Kelas | Nilai  | Dipakai untuk                                   |
| ----- | ------ | ----------------------------------------------- |
| `rounded-sm`  | 7px    | Input, textarea, select, alert, checkbox 4px     |
| `rounded-md`  | 18px   | **Kartu, sidebar, header, dropdown**             |
| `rounded-2xl` | 30px   | **Tombol** (`.btn`), kapsul                      |
| `rounded-3xl` | 50rem  | Badge/pil status, badge menu                     |
| `rounded-full`| 50%    | Avatar, ikon bulat, tombol ikon                  |

### 2.4 Bayangan

| Kelas       | Nilai                              | Dipakai untuk                          |
| ----------- | ---------------------------------- | -------------------------------------- |
| `shadow-md` | `0 2px 6px rgba(37,83,185,.10)`    | Kartu, header, sidebar (`shadow-card`) |
| `shadow-sm` | `0 .5rem 1rem rgba(0,0,0,.15)`     | Dropdown/popover                       |
| `shadow-xl` | `inset 0 1px 2px rgba(90,106,133,.075)` | Input disabled                     |

### 2.5 Spasi & kontainer

`card-body` = `p-6` (24px). Jarak antar blok `gap-6`; grid kartu `grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6`. Kontainer `max-w-7xl`, tengah. Header: `py-4 px-6`. Halaman: `p-5` di sekeliling, konten `xl:px-6`.

### 2.6 Dark mode

Template hanya light. Dark mode **diturunkan dari palet proyek** tanpa hue baru: latar hijau-hitam `#0f1a14`, kartu `#16251c`, sidebar `#0c1f16`, primary hijau terang `#5fb383`, aksen `#ff6a47`; tint = warna solid pada opasitas 15% di atas kartu (nilai lengkap di §2.1).

## 3. Layout Shell

```
 bg-background (krem), padding 20px
 ┌────────────┐  ┌───────────────────────────────────────┐
 │ Sidebar    │  │ Header (panel krem terang, rounded-md)  │
 │ 270px      │  └───────────────────────────────────────┘
 │ panel hijau│  ┌───────────────────────────────────────┐
 │ rounded-md │  │ Konten: kartu-kartu (gap-6)            │
 │ shadow-md  │  │                                       │
 │ melayang   │  └───────────────────────────────────────┘
 └────────────┘
```

- **Sidebar**: lebar 270px, **panel hijau tua mengambang** (`bg-sidebar shadow-card rounded-md`, `xl:` fixed di kiri dengan jarak 20px dari tepi), bukan penuh-tinggi. Di bawah `xl` (<1280px) menjadi *drawer* geser dari kiri (overlay backdrop `rgba(0,0,0,.5)`) dibuka tombol menu di header. Konten digeser `margin-left: 270px` di `xl`.
- **Header**: panel `bg-card rounded-md shadow-card py-4 px-6`, kiri: tombol menu (hanya <xl) + ikon notifikasi; kanan: aksi utama (tombol kapsul) + avatar profil (dropdown).
- **Top strip** gelap di atas (opsional; dipakai template untuk promosi) — **tidak dipakai** di aplikasi.
- **Konten**: `container max-w-7xl`, `flex flex-col gap-6`. Satu judul halaman per halaman.

### Sidebar item (struktur template, warna palet)

- Grup: label `text-xs font-semibold` uppercase `sidebar-muted` (HOME, UI COMPONENTS, APPS…), `mt-6 mb-4`.
- Item: `gap-3 py-2.5 my-1 text-base flex items-center rounded-md text-sidebar-foreground`, ikon `text-2xl ps-2`.
- **Hover & aktif**: latar `sidebar-accent` yang menyapu dari kiri sebagai pil sudut-kanan membulat (`0 24px 24px 0`, transisi 0.4s), teks `sidebar-accent-foreground`.
- Badge menu (mis. "Pro"): `bg-sidebar-primary text-white rounded-3xl px-2 text-xs py-0.5`.
- Submenu: accordion dengan chevron; judul aktif `text-sidebar-primary`.

## 4. Responsif

| Breakpoint | Perilaku template                                                          |
| ---------- | -------------------------------------------------------------------------- |
| ≥1280px (`xl`) | Sidebar 270px tetap; grid kartu 4 kolom                               |
| 1024–1279px (`lg`) | Sidebar jadi drawer; grid 2 kolom; grid 3 kolom untuk kartu lebar  |
| <1024px    | 1 kolom; `px-0` konten                                                      |

Tidak boleh ada scroll horizontal di 375px (`e2e/responsive.spec.ts`). Tabel lebar dibungkus `overflow-x-auto`.

## 5. Komponen Template → Padanan Aplikasi

> Kolom "struktur" meniru kelas template (radius, padding, ukuran, layout). **Kelas warna template** (`blue-600`, `teal-500`, `gray-400`, …) dibaca lewat peta §2.1 — di kode selalu pakai token (`bg-primary`, `text-muted-foreground`, `bg-tone-green-soft`, …).

Gunakan tabel ini sebagai **daftar pertama** sebelum membuat komponen. Semua tampilan mengikuti kelas template; primitif Radix/shadcn hanya untuk perilaku.

| Komponen template (`package/src`)           | Struktur / kelas inti                                                                 | Padanan di aplikasi                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Card** (`components/cards.html`, `.card`) | `rounded-md shadow-md bg-white`; isi `.card-body` = `p-6`; judul `text-lg font-semibold text-gray-500` | `ui/card` (restyle: radius 18, shadow-card, padding 24) |
| **Buttons** (`components/buttons.html`)     | `.btn`: `rounded-2xl bg-blue-600 text-white text-sm py-3 px-7`; varian solid (primary/secondary/success/warning/danger/info/dark/light), **outline** (border + teks warna, hover isi penuh), **link** (teks biru), ukuran `py-2 px-7 text-base font-medium` | `ui/button` (restyle: radius 30, padding, varian sesuai) |
| **Forms** (`components/forms.html`)         | Input/select/textarea: `py-3 px-4 block w-full border-gray-200 rounded-sm text-sm focus:border-blue-600 focus:ring-0`; disabled `bg-gray-200 opacity-60 shadow-xl`; label `text-sm text-gray-400 mb-2`; helper `text-sm text-gray-400 opacity-75 mt-2`; checkbox/radio `rounded-[4px] border-gray-400 text-blue-600` | `ui/input`, `ui/textarea`, `ui/select`, `ui/checkbox`, `ui/label`, `shared/form-field`, `shared/select-field` |
| **Alerts** (`components/alerts.html`)       | `border text-sm rounded-sm p-4` + tint: primary `bg-blue-500 text-blue-600`, success `bg-teal-400 text-teal-500`, warning `bg-yellow-400 text-yellow-500`, danger `bg-red-400 text-red-500`, info `bg-blue-200 text-blue-300`, light/dark | `ui/alert` bila belum ada → buat dari template; toast `sonner` bertone sama |
| **Badge / pil status** (`pages/index.html`) | `inline-flex items-center py-2 px-4 rounded-3xl font-semibold` + `bg-{tint} text-{solid}` (blue/teal/yellow/red). Varian kecil: `px-2 text-xs py-0.5` | `shared/tone-badge` (restyle), `ui/badge` |
| **Tabel** (`pages/index.html` §Table)       | `text-left w-full whitespace-nowrap text-sm text-gray-500`; `th`: `p-4 font-semibold`; `td`: `p-4`; dibungkus `.card` + `overflow-x-auto` | `ui/table`, `shared/data-table` (restyle) |
| **Typography** (`components/typography.html`)| Heading `text-2xl/3xl/4xl`, teks `text-base`, link `text-blue-600 underline hover:text-blue-700`, muted `text-gray-400` | kelas utilitas langsung |
| **Header** (`partials/header.html`)         | Panel putih `rounded-md shadow-md py-4 px-6`, tombol menu mobile, notifikasi, aksi + profil | `layout/app-topbar` |
| **Dropdown notifikasi** (`header-components/dd-notification.html`) | Ikon lonceng + dot, menu `card hs-dropdown-menu` | `notifications/notification-bell` + `ui/dropdown-menu` |
| **Dropdown profil** (`header-components/dd-profile.html`) | Avatar bulat + menu `card`, item `px-4 py-2.5 hover:bg-gray-200 text-gray-400` | `layout/user-menu` + `ui/dropdown-menu` |
| **Sidebar** (`partials/sidebar.html`, `logo-sidebar.html`) | Lihat §3. Logo di atas (`p-4`), nav `px-4`, scroll sidebar | `layout/app-sidebar` + `ui/sidebar` (restyle penuh) |
| **Auth** (`pages/authentication-login.html`, `-register.html`) | Kartu form di tengah, latar `radial-gradient` lembut | `(auth)/layout`, `shared/auth-card` |
| **Stat/ikon bulat** (`pages/index.html`)    | Lingkaran `w-5 h-5 rounded-full bg-{tint}` + ikon; angka `text-[22px] font-semibold`; delta `font-medium text-teal-500` | `shared/stat-card`, `shared/icon-tile`, `shared/trend-badge` (restyle) |
| **Grafik** (`assets/js/dashboard.js`)       | ApexCharts | grafik aplikasi (Recharts) memakai `chart-1…5` (hijau tua → hijau → kuning → teal → merah-oranye) |
| **Icons** (`pages/icons.html`)              | Tabler Icons                                                                           | `lucide-react` (padanan terdekat)                      |

### Pola yang TIDAK ada di template (boleh dibuat, ikuti gaya template)

Hanya bila tidak ada padanan di tabel di atas. Gunakan token & radius template; daftarkan di sini saat dibuat.

| Pola | Komponen | Catatan gaya |
| ---- | -------- | ------------ |
| Tab segmen / sub-nav Settings | `ui/tabs`, `layout/settings-nav` | aktif = tint primary + teks primary, radius `md`/`full`, tanpa border tebal |
| Empty state | `shared/empty-state` | border putus-putus `border`, ikon dalam lingkaran `muted`, teks `gray-400` |
| Skeleton, Dialog, Sheet, Command palette, Tooltip | `ui/*` | latar `card`, radius `md`, shadow `sm` (popover) |
| Progress bar | `shared/progress-bar` | track `muted`, isi warna tone, `rounded-full` |
| Detail field, Page actions, Entity sheet, Rich text editor | `shared/*` | label `text-sm text-gray-400`, nilai `text-sm text-gray-500` |
| Panel Automation (daftar rule, dialog rule, log eksekusi) | `modules/automation/components/*` | Card + daftar `divide-y` seperti panel Settings lain; status = `ToneBadge` |
| Inbox WhatsApp (daftar percakapan + thread + composer), daftar connector WhatsApp | `modules/whatsapp/components/*` | dua kolom dalam `Card`; gelembung masuk = `card` + border, keluar = `primary`; daftar connector mengikuti pola AI/Email |
| Kartu webhook keluar (Zapier/Make) & kartu Google | `modules/integrations/components/*` | Card + daftar `divide-y`, dialog bersama untuk tambah/ubah, status = `ToneBadge` |
| Panel Tanya CRM (input + chip contoh + tabel hasil), panel draf AI di quotation | `modules/insights/components/*`, `quotations/components/quotation-builder` | Card + `Table` template; draf AI = kotak berborder putus-putus dengan peringatan `tone-orange` |
| Report Builder (form + pratinjau + laporan tersimpan + dialog jadwal), panel segmen dinamis | `modules/reports/components/report-builder`, `modules/customers/components/dynamic-segments-panel` | Card + `Table` template, dialog bersama, chip toggle `aria-pressed` untuk pilihan ganda |
| Kartu Persetujuan & Riwayat versi quotation, panel Template aktivitas, kartu Peluang repeat purchase | `quotations/components/quotation-extras`, `activities/components/templates-panel`, `customers/components/repeat-card` | Card + daftar `divide-y`, status = `ToneBadge`, diff = daftar dengan badge Ditambah/Dihapus/Diubah |
| Tag (chip), tag picker, input custom field, bar saved view, panel Settings Tags/Custom Fields | `modules/customization/components/*` | tag = `ToneBadge` (5 tone, tanpa warna baru); input memakai `FormField`/`SelectField`/`Checkbox` template; bar saved view = `SelectField` + `Button` outline + `Dialog`; panel Settings meniru `lead-sources-panel` (Card + daftar `divide-y`) |

Komponen mockup lama yang **dihentikan** (tidak ada di template; jangan dipakai di halaman baru, hapus saat menyentuh file terkait): `HeroBanner`/`HeroStat`, `QuickAction`, `PendingCard` bergradien, medali/peringkat bergradien, token `tone-*`/`gradient-*` lama. Gantikan dengan `Card` + `Badge`/`Alert` bertone template.

## 6. Interaksi & Aksesibilitas

- Fokus terlihat: template memakai `focus:border-blue-600 focus:ring-0` pada input; **tambahkan** ring/outline tipis `primary/40` agar tetap terlihat oleh keyboard (aksesibilitas menang atas template).
- Target sentuh ≥ 40px (tombol template `py-2/py-3` sudah ≥ 36–44px).
- Kontras: `muted-foreground #666b63` di atas krem ≈ 4.7:1 (cukup untuk ≥14px). Kuning `#e0a030` dan merah-oranye `#ff4b26` **bukan** warna teks di atas krem — pakai pada tint/ikon/tombol dan tulis teksnya dengan `foreground` atau `tone-*-ink`. Teks putih di atas `#ff4b26` ≈ 3.3:1: hanya untuk tombol/label ≥14px tebal.
- Status tidak boleh hanya warna: sertakan ikon atau teks.
- Hormati `prefers-reduced-motion`; transisi menu 0.4s ease-in-out hanya untuk efek sapuan sidebar.
- Semua tombol ikon-saja punya `aria-label`.

## 7. Bahasa & Konten

UI berbahasa Indonesia. Uang `Rp 84 jt` / `Rp 2,4 M` pada KPI ringkas dan `Rp 4.500.000` pada tabel (`Intl.NumberFormat("id-ID")`). Tanggal `1 Apr 2026` lewat `date-fns/locale/id`.

## 8. Status Migrasi

Seluruh frontend sudah memakai template untuk struktur dan palet proyek (§2.0) untuk warna: token & font (`globals.css`, Plus Jakarta Sans), radius/shadow, shell (sidebar hijau tua melayang + header panel krem), dan komponen `ui/*` serta `shared/*`. Nama token `tone-blue/green/orange/purple/red` **dipertahankan** tetapi nilainya dipetakan ke palet (blue=primary hijau tua, green=sukses, orange=peringatan, purple=info teal, red=bahaya merah-oranye) — lihat §2.1. Teks error memakai `text-tone-red-ink`.

Dihapus: `HeroBanner`, `QuickAction`, `PendingCard` (tidak ada di template, tidak dipakai halaman mana pun).

Tab segmen & sub-nav Settings: pil tint (`bg-secondary text-primary`), pola tanpa padanan template (§5).

Sisa: tinjauan visual per halaman di browser (tabel padat, form panjang, kalender, quotation builder).

## 9. Checklist Review UI

- [ ] Sudah mencari padanan di template (`spike-tailwind`) sebelum membuat komponen baru? Alasan bila baru tercatat di §5?
- [ ] Hanya token (tidak ada hex/px warna/shadow baru)?
- [ ] Radius sesuai §2.3 (kartu `md` 18, tombol `2xl` 30, input `sm` 7, badge `3xl`)?
- [ ] Warna sesuai makna §2.1; status tidak hanya warna?
- [ ] Tampil benar di 375 / 768 / 1440 tanpa scroll horizontal?
- [ ] Fokus keyboard terlihat, tombol ikon berlabel?
- [ ] Light dan dark sama-sama terbaca?

> **Ukuran tombol (seragam):** semua tombol teks `h-10 px-6 text-sm`, semua tombol ikon `size-10` bulat. Prop `size` (`sm`/`lg`/`xs`) hanya alias dan tidak mengubah ukuran; jangan menambah `className` tinggi/padding pada Button.
