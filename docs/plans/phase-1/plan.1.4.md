# Plan 1.4 — Connector Hub foundation & BYOK AI

| Item            | Detail                                      |
| --------------- | ------------------------------------------- |
| Phase           | [Phase 1 — MVP](../../phase/phase-1-mvp.md) |
| Referensi PRD   | CONN-01–04; Sprint 1                        |
| Prioritas       | P0                                          |
| Bergantung pada | 1.3                                         |
| Status          | Lihat [PROGRESS.md](../../PROGRESS.md)      |

## Tujuan

Katalog Connector Hub dan manajemen API key AI mandiri (terenkripsi) berfungsi.

## Tugas

- [ ] Util enkripsi AES-256-GCM (`src/lib/crypto.ts`) dengan master key dari env; test round-trip dan tamper detection.
- [ ] Model `TenantConnector` (tipe, config terenkripsi, status, organization_id).
- [ ] UI Settings → Connectors & Integrations: Card Grid (AI Models, Inbound Webhooks, WhatsApp, Email).
- [ ] Form BYOK untuk Google Gemini, OpenAI, Anthropic, OpenRouter; key dimasking di UI (`sk-...xxxx`), tidak pernah dikirim balik ke client.
- [ ] Tombol Test Connection (server-side, via Vercel AI SDK) dengan pesan error jelas.
- [ ] Abstraksi `getAiModel(organizationId)` untuk dipakai fitur Safe AI berikutnya.
- [ ] Audit log untuk perubahan connector; hanya Owner/Admin yang boleh mengelola.

## Pustaka (Library-First, PRD §10.2)

Gunakan pustaka standar berikut; jangan membuat ulang dari nol: `Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)`, `Node crypto`.

## Acceptance Criteria

- [ ] API key tersimpan terenkripsi dan terisolasi per tenant.
- [ ] Test Connection menunjukkan sukses/gagal untuk key valid/invalid.
- [ ] Key tidak pernah muncul di response, log, atau audit log.

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Jalankan juga verifikasi manual/E2E yang relevan dengan acceptance criteria di atas.

## Penutup Plan (WAJIB)

Plan dianggap selesai hanya setelah kedua langkah ini dilakukan, berurutan:

1. [ ] **Update progress** — ubah status plan 1.4 di [`docs/PROGRESS.md`](../../PROGRESS.md) menjadi `Done`, isi tanggal selesai dan catatan singkat (dan centang acceptance criteria di atas).
2. [ ] **Commit** — jalankan verifikasi, lalu commit semua perubahan plan ini (termasuk `PROGRESS.md`):

```bash
git add -A
git commit -m "feat(connectors): plan 1.4 - Connector Hub foundation & BYOK AI" \
  -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Jangan mulai plan berikutnya sebelum plan ini ter-commit.
