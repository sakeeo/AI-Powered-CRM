#!/usr/bin/env bash
# Backup Postgres terenkripsi (pg_dump custom format → AES-256-CBC PBKDF2).
# Pemakaian:  DATABASE_URL=… BACKUP_PASSPHRASE=… ./scripts/backup.sh
# Opsi: BACKUP_DIR (default ./backups), KEEP_DAYS (default 14), PG_DOCKER_NETWORK (jalankan pg_dump via docker bila tak ada di host)
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL wajib}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE wajib}"
DIR="${BACKUP_DIR:-./backups}"; KEEP="${KEEP_DAYS:-14}"
mkdir -p "$DIR"; chmod 700 "$DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"; OUT="$DIR/crm-$TS.dump.enc"

# pg_dump lokal bila ada; jika tidak, pakai image postgres:16 lewat docker (network host).
URL="${DATABASE_URL%%\?*}"   # buang ?schema=public (tidak dikenal libpq)
if command -v pg_dump >/dev/null 2>&1; then
  PGDUMP=(pg_dump)
else
  PGDUMP=(docker run --rm -i --network "${PG_DOCKER_NETWORK:-host}" postgres:16-alpine pg_dump)
fi

"${PGDUMP[@]}" --format=custom --no-owner --no-privileges "$URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT"
[ -s "$OUT" ] || { echo "Backup kosong, dibatalkan" >&2; rm -f "$OUT"; exit 1; }
chmod 600 "$OUT"
( cd "$DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
find "$DIR" -name 'crm-*.dump.enc*' -mtime "+$KEEP" -delete
echo "Backup selesai: $OUT ($(du -h "$OUT" | cut -f1))"
