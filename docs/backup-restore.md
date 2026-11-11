# Backup & Restore

## Yang dibackup

| Data | Cara | Catatan |
| --- | --- | --- |
| PostgreSQL (seluruh data aplikasi) | `scripts/backup.sh` (pg_dump format custom, dienkripsi AES-256-CBC/PBKDF2) | Sumber kebenaran. |
| Object storage (PDF quotation, dll.) | Volume `miniodata` — salin dengan `mc mirror` atau snapshot volume | PDF quotation dibuat ulang otomatis saat diunduh, jadi risiko kehilangannya rendah. |
| Rahasia (`.env.production`, terutama `ENCRYPTION_KEY`) | Password manager / secret manager, **terpisah** dari backup DB | Tanpa `ENCRYPTION_KEY`, API key & secret connector pada backup tidak bisa didekripsi. |

## Backup terjadwal

```bash
# /etc/cron.d/crm-backup — tiap hari 02:15 UTC, simpan 14 hari, notifikasi bila gagal
15 2 * * * root cd /opt/crm && set -a && . ./.env.production && set +a && \
  DATABASE_URL="postgresql://crm_user:${POSTGRES_PASSWORD}@127.0.0.1:5432/crm" PG_DOCKER_NETWORK=crm-prod_default \
  ./scripts/backup.sh || curl -fsS -d "BACKUP CRM GAGAL" https://ntfy.sh/topik-anda
```

Catatan: pada compose production Postgres tidak membuka port ke host; jalankan `backup.sh` dengan `PG_DOCKER_NETWORK=crm-prod_default` dan `DATABASE_URL` yang memakai host `postgres` (`postgresql://crm_user:…@postgres:5432/crm`) agar `pg_dump` dijalankan dalam jaringan Docker. Salin berkas `*.dump.enc` (+`.sha256`) ke penyimpanan **off-site** (S3/Backblaze/rsync) — backup di server yang sama tidak melindungi dari kehilangan server.

Retensi default 14 hari (`KEEP_DAYS`). Berkas backup berizin 600 dan terenkripsi; passphrase di `BACKUP_PASSPHRASE`.

## Restore

```bash
# 1. siapkan database kosong target (server baru atau database baru)
# 2. restore (verifikasi checksum otomatis)
BACKUP_PASSPHRASE=… ./scripts/restore.sh backups/crm-20261111T161645Z.dump.enc postgresql://user:pass@host:5432/crm
# 3. jalankan migrasi bila backup lebih lama dari kode:  docker compose … run --rm migrate
# 4. start app + worker, cek /api/health, dan periksa data di UI
```

`restore.sh` memakai `--clean --if-exists` sehingga **menimpa** objek di database target — jangan arahkan ke database yang sedang dipakai kecuali memang pemulihan darurat (hentikan `app` dan `worker` dulu).

Target: RPO = 24 jam (backup harian; naikkan frekuensi bila perlu), RTO ≈ 30–60 menit (provision server → restore → migrate → start).

## Restore drill (wajib diulang berkala, minimal tiap kuartal & sebelum rilis besar)

```bash
set -a; . ./.env; set +a          # DATABASE_URL sumber
./scripts/restore-drill.sh
```

Skrip: backup sumber → menyalakan Postgres **terpisah** (container sementara di port 55432) → restore → membandingkan jumlah baris 17 tabel kunci + riwayat migrasi antara sumber dan hasil restore → menghapus container. Keluar kode ≠ 0 bila ada perbedaan.

### Catatan hasil drill

| Tanggal | Sumber | Hasil |
| --- | --- | --- |
| 2026-11-12 | database dev (66 organisasi, 23 lead, 30 deal, 241 audit log, 17 migrasi; dump 180 KB) | **Berhasil**: 17/17 tabel identik (jumlah baris), checksum backup valid, restore ke Postgres 16 terpisah tanpa error. |

Keterbatasan drill ini: dijalankan pada mesin pengembangan dengan data uji, bukan pada server production. Ulangi pada server production setelah deploy pertama dan catat di tabel di atas.
