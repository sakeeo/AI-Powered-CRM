<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design system (WAJIB untuk semua frontend)

Satu-satunya referensi UI/UX adalah [`docs/design-system.md`](docs/design-system.md), yang bersumber dari mockup [`docs/mockup-dasboard.html`](docs/mockup-dasboard.html). Sebelum menulis atau mengubah UI:

1. Baca `docs/design-system.md` (token, tone, tipografi, pola komponen, checklist §9).
2. Pakai token di `src/app/globals.css` dan komponen di `src/components/ui` + `src/components/shared`; **jangan** hardcode hex/shadow atau memakai referensi desain lain.
3. Pola baru yang dipakai ≥2 tempat → jadikan komponen `shared/` dan dokumentasikan di design-system.md. Bila mockup berubah, perbarui dokumen yang sama di commit yang sama.
