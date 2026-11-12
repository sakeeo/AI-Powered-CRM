<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design system (WAJIB untuk semua frontend)

Satu-satunya acuan tampilan UI adalah template **[`docs/spike-tailwind/`](docs/spike-tailwind/)** (Spike / Modernize Tailwind Admin Template; HTML sumber di `docs/spike-tailwind/package/src`, hasil build di `docs/spike-tailwind/dist`). Template menentukan **struktur** (layout, komponen, radius, tipografi); **warna** memakai palet proyek krem / hijau tua / merah-oranye (60/30/10) di `docs/design-system.md` §2.0. Aturan kerja ada di [`docs/design-system.md`](docs/design-system.md). Mockup lama (`docs/mockup-dasboard.html`) **tidak lagi dipakai**. Sebelum menulis atau mengubah UI:

1. Baca `docs/design-system.md` (token, radius, tipografi, peta komponen §5, checklist §9).
2. **Prioritaskan komponen yang ada di template.** Cari padanannya di `docs/spike-tailwind/package/src/{components,pages,partials}` dan tiru strukturnya sebelum membuat komponen baru. Komponen baru hanya bila template tidak punya padanan; catat di design-system.md §5.
3. Pakai token di `src/app/globals.css` dan komponen di `src/components/ui` + `src/components/shared`; **jangan** hardcode hex/shadow atau memakai referensi desain lain.
4. Pola baru yang dipakai ≥2 tempat → jadikan komponen `shared/` dan dokumentasikan di design-system.md. Bila template berubah, perbarui dokumen yang sama di commit yang sama.
