# Plan 0.4 — UI foundation & app shell

| Item            | Detail                                                  |
| --------------- | ------------------------------------------------------- |
| Phase           | [Phase 0 — Project Setup](../../phase/phase-0-setup.md) |
| Referensi PRD   | §5, §10.2                                               |
| Prioritas       | P0                                                      |
| Bergantung pada | 0.1                                                     |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)                  |

## Tujuan

Design system dan kerangka aplikasi siap: komponen dasar, theming, dan layout dengan sidebar.

## Tugas

- [x] Inisialisasi shadcn/ui; tambahkan komponen: Button, Dialog, DropdownMenu, Tabs, Sheet, Badge, Avatar, Separator, Input, Form, Table, Command, Sonner.
- [x] Pasang `next-themes` (Dark/Light/System) dengan token CSS variables semantik.
- [x] Pasang `lucide-react`, `sonner`, `cmdk`, `date-fns`.
- [x] Bangun app shell: collapsible sidebar sesuai struktur navigasi §5, header dengan theme toggle, area konten.
- [x] Buat halaman placeholder untuk setiap menu utama (Dashboard, Leads, Contacts, Companies, Deals, Activities, Quotations, Reports, Settings) dengan empty state.
- [x] Pasang kerangka Command Palette (Ctrl/Cmd+K) dengan navigasi antarhalaman.
- [x] Pastikan layout responsif (desktop, tablet, smartphone) dan densitas data tinggi (compact spacing).

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `shadcn/ui`, `Radix UI`, `next-themes`, `cmdk`, `lucide-react`, `Sonner`, `date-fns`.

## Acceptance Criteria

- [x] Sidebar dapat dilipat; theme toggle bekerja dan tersimpan.
- [x] Seluruh menu utama menampilkan halaman placeholder.
- [x] Tampilan layak di lebar 375px, 768px, dan desktop. (desktop dicek manual; 375px/768px diverifikasi otomatis di plan 0.5)

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Jalankan juga verifikasi manual/E2E yang relevan dengan acceptance criteria di atas. Pada Phase 0, script `typecheck` baru tersedia setelah plan 0.1 dan `test` setelah plan 0.5; lewati yang belum ada.

## Penutup Plan (WAJIB)

Plan dianggap selesai hanya setelah kedua langkah ini dilakukan, berurutan:

1. [x] **Update progress** — ubah status plan 0.4 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [x] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "chore(ui): plan 0.4 - UI foundation & app shell" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
