#!/usr/bin/env bash
# Restore backup terenkripsi ke database TARGET (harus kosong / boleh ditimpa).
# Pemakaian:  BACKUP_PASSPHRASE=… ./scripts/restore.sh backups/crm-XXXX.dump.enc postgresql://user:pass@host:5432/dbname
# PERINGATAN: --clean menghapus objek yang ada di database target.
set -euo pipefail
FILE="${1:?berkas backup wajib}"; TARGET="${2:?URL database target wajib}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE wajib}"
[ -f "$FILE" ] || { echo "Berkas tidak ada: $FILE" >&2; exit 1; }
if [ -f "$FILE.sha256" ]; then ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" ); fi
URL="${TARGET%%\?*}"
if command -v pg_restore >/dev/null 2>&1; then
  PGRESTORE=(pg_restore)
else
  PGRESTORE=(docker run --rm -i --network "${PG_DOCKER_NETWORK:-host}" postgres:16-alpine pg_restore)
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" \
  | "${PGRESTORE[@]}" --clean --if-exists --no-owner --no-privileges --exit-on-error -d "$URL"
echo "Restore selesai ke database target."
