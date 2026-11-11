# Runbook Deployment Production

Arsitektur: satu VPS/VM (Docker) atau managed container. `docker-compose.prod.yml` menjalankan **caddy** (HTTPS otomatis) → **app** (Next.js standalone) + **worker** (BullMQ) + **postgres** + **redis** + **minio**. Hanya port 80/443 yang terbuka; database/redis/minio tidak diekspos ke host.

> Status: konfigurasi dan prosedur ini sudah disiapkan dan backup/restore sudah diuji (lihat `docs/backup-restore.md`). **Deployment ke server production sungguhan belum dilakukan** — itu langkah operasional pemilik produk (butuh server, domain, dan DNS). Ikuti bagian "Deploy pertama".

Catatan: image `worker` dan `migrate` dibangun dari tahap builder (±2,8 GB karena menyertakan devDependencies untuk `tsx`/`prisma`); image `app` ±70–300 MB. Worker terverifikasi berjalan (log "Worker berjalan (mail, reminders)"). Optimasi ukuran image worker adalah backlog.

## Prasyarat

- Server Linux (≥ 2 vCPU, 4 GB RAM, 40 GB disk) dengan Docker Engine + plugin Compose v2.
- Domain dengan A/AAAA record ke IP server (untuk sertifikat Let's Encrypt otomatis), port 80 & 443 terbuka.
- Firewall: izinkan hanya 22 (SSH, idealnya dibatasi IP), 80, 443.

## Variabel environment

Salin `.env.production.example` → `.env.production` (di server, **jangan di-commit**; izin `chmod 600`).

| Variabel | Keterangan |
| --- | --- |
| `APP_DOMAIN` | Domain publik (tanpa `https://`). `BETTER_AUTH_URL` dibentuk otomatis. |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | Password acak kuat. |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | Kredensial MinIO (bucket dibuat otomatis oleh job `migrate`). |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (≥ 32 karakter). Mengganti nilai ini memutus semua sesi. |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (32 byte base64). **Hilang = semua API key/secret connector tidak dapat didekripsi.** Simpan salinan di password manager, terpisah dari backup database. |
| `REQUIRE_EMAIL_VERIFICATION` | `true` bila email delivery sudah dikonfigurasi. |
| `BACKUP_PASSPHRASE` | Passphrase enkripsi backup (lihat backup-restore). |

Aplikasi memvalidasi env dengan Zod saat start; konfigurasi salah membuat proses berhenti dengan pesan jelas.

## Deploy pertama

```bash
git clone https://github.com/sakeeo/AI-Powered-CRM.git /opt/crm && cd /opt/crm
cp .env.production.example .env.production && chmod 600 .env.production   # isi nilai nyata
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -fsS https://$APP_DOMAIN/api/health     # {"status":"ok",...}
```

`up -d` otomatis menjalankan job **migrate** (`prisma migrate deploy` + membuat bucket) sebelum `app` dan `worker` start; bila migrasi gagal, app tidak naik.

Setelah itu: buka `https://$APP_DOMAIN/sign-up`, daftar akun Owner, buat organisasi, lalu di **Settings → Connectors** konfigurasikan **Email Delivery** (kirim email uji) dan AI key bila diperlukan.

## Update / rilis baru

```bash
cd /opt/crm && git pull
./scripts/backup.sh                     # selalu backup sebelum migrasi
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d   # migrate otomatis
curl -fsS https://$APP_DOMAIN/api/health
```

**Rollback**: kembalikan kode (`git checkout <tag/commit lama>`), build ulang, `up -d`. Migrasi bersifat maju-saja; bila migrasi baru merusak data, restore backup sebelum rilis (lihat backup-restore). Pemicu rollback: health check gagal > 5 menit setelah rilis, error rate naik, atau data korup.

## Monitoring, logging, alert

- **Health check**: `GET /api/health` memeriksa Postgres, Redis, dan object storage; HTTP 503 bila ada yang gagal. Dipakai oleh Docker `HEALTHCHECK`, Caddy (`health_uri`), dan monitor eksternal.
- **Alert dasar**: pasang uptime monitor (UptimeRobot/Better Stack, atau cron `scripts/healthcheck.sh https://$APP_DOMAIN` dengan notifikasi ntfy/email) pada `/api/health` setiap 1 menit. Tambahkan alert disk > 80% dan backup gagal (cron backup mengirim notifikasi bila exit ≠ 0).
- **Logging terpusat**: semua proses menulis log JSON (pino) ke stdout dengan redaksi secret. `docker compose logs -f app worker caddy`; untuk terpusat arahkan driver log Docker ke Loki/Grafana/Datadog (`logging: driver: …`) atau `journald`. Log worker mencatat tiap job email/reminder yang gagal.
- **Error tracking**: titik integrasi ada di `src/lib/error-tracking.ts` (`reportError`). Untuk Sentry: pasang `@sentry/nextjs`, set `SENTRY_DSN`, dan panggil `Sentry.captureException` di `reportError` (tidak dipasang default agar tidak mengirim data keluar tanpa persetujuan).
- **Worker**: bila mati, email/reminder tertahan di Redis dan diproses setelah hidup kembali (`restart: unless-stopped`).

## Keamanan operasional

- Jangan buka port 5432/6379/9000. Gunakan `docker compose exec postgres psql …` untuk akses manual.
- Rotasi: `BETTER_AUTH_SECRET` (memutus sesi), password DB/Redis (update `.env.production` + ubah di server data), `ENCRYPTION_KEY` **tidak dapat dirotasi sederhana** (perlu re-enkripsi connector; belum ada tooling — catat sebagai backlog).
- Redis memuat job email berisi tautan reset yang belum terkirim; lindungi dengan password (sudah) dan jangan ekspos.
- Perbarui image dasar secara berkala (`docker compose build --pull`) dan jalankan `npm audit`.
