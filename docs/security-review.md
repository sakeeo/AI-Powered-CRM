# Tinjauan Keamanan (OWASP Top 10 / IDOR) — plan 1.19

Status: dilakukan 2026-11-12 atas kode MVP. Tidak ada temuan severity tinggi yang terbuka.

## Ringkasan per kategori

| Area | Kontrol yang ada | Bukti |
| --- | --- | --- |
| A01 Broken access control / IDOR | Setiap query lewat `ctx.db` (`forTenant`, otomatis `organizationId`), izin CASL (`assertCan`/`scopeWhere`) di server; ESLint melarang `prisma` mentah di modul bisnis; tenant diambil dari session+membership, bukan input klien. Route handler (export, PDF, webhook) memeriksa session/izin sendiri. | `tests/integration/tenant-isolation.test.ts`, `security.test.ts` (≈26 aksi lintas-tenant ditolak, data asal utuh), `abilities.test.ts` |
| A02 Cryptographic failures | Secret connector & webhook dienkripsi AES-256-GCM (AAD per tenant+tipe, tamper terdeteksi); password di-hash Better Auth; HSTS aktif. | `crypto.test.ts`, `security.test.ts` (kerahasiaan secret) |
| A03 Injection | Prisma (parameterized), semua input server action divalidasi Zod, HTML catatan disanitasi (`sanitize-html` allowlist), CSV/XLSX export menetralkan formula (`safeCell`). Tidak ada raw SQL berisi input pengguna. | `timezone.test.ts` (sanitize), `import-export-webhook.test.ts` |
| A04 Insecure design | AI Red Zone: AI hanya draf, total uang dihitung kode, tidak ada auto-send/mutasi. | `security.test.ts` (pemindaian sumber + snapshot semua tabel) |
| A05 Misconfiguration | Header keamanan (`nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS); `X-Powered-By` dimatikan; validasi env Zod saat start. CSP penuh **belum** diaktifkan (Next.js memakai skrip inline; butuh nonce) — direncanakan pasca-MVP. | `next.config.ts` |
| A06 Vulnerable components | `npm audit --omit=dev`: 0 high/critical; 8 moderate/low pada rantai CLI `shadcn`/`ts-morph` (tidak dijalankan di runtime) dan `uuid` via `exceljs` (celah hanya bila `buf` diberikan; tidak dipakai). Dipantau; ditinjau ulang tiap rilis. | `npm audit` |
| A07 Identification & auth failures | Better Auth, rate limit login/sign-up/reset via Redis, cookie session HttpOnly, reset token 1 jam, `proxy.ts` + `requireSession()`. | `auth.test.ts`, E2E auth |
| A08 Integrity failures | Webhook masuk: HMAC-SHA256 + `timingSafeEqual`, ukuran payload dibatasi, rate limit. Migrasi database tervalidasi di CI. | `import-export-webhook.test.ts` |
| A09 Logging & monitoring | Pino dengan redaksi (password, token, apiKey, cookie, authorization), audit log append-only (secret diredaksi), log penerimaan webhook, `reportError`. | `logger.test.ts`, `security.test.ts` |
| A10 SSRF | Server tidak mengambil URL dari input pengguna (wa.me hanya tautan klien; webhook hanya menerima). Connector AI memakai host tetap penyedia. | tinjauan kode |

## Validasi API & rate limiting

- Server Action: semua dibungkus `tenantAction(schema, …)` — validasi Zod di server, galat seragam, tanpa membocorkan detail internal.
- Route handler: parameter di-whitelist (`entity`, `type`, `format`); id tak valid menghasilkan 404 seragam (bukan 403) agar tidak membocorkan keberadaan record.
- Rate limit: auth (Better Auth + Redis), webhook masuk (60/menit per webhook). Endpoint export/PDF dilindungi session + izin; batas baris export 20.000.

## Risiko residual yang diterima untuk MVP

1. CSP penuh belum aktif (lihat A05).
2. Job email yang gagal tetap tersimpan di Redis hingga 24 jam dan memuat isi email (mis. tautan reset). Redis tidak boleh diekspos publik dan sebaiknya dilindungi password/TLS di production.
3. Rate limit endpoint pembacaan umum belum ada (mengandalkan reverse proxy/WAF di production).
