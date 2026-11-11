#!/usr/bin/env bash
# Restore drill: backup database sumber → restore ke Postgres TERPISAH (container sementara) →
# verifikasi jumlah baris tabel kunci + riwayat migrasi → hapus container.
# Pemakaian:  DATABASE_URL=postgresql://… ./scripts/restore-drill.sh      (BACKUP_PASSPHRASE opsional; dibuat acak)
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL sumber wajib}"
export BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-$(openssl rand -base64 24)}"
DRILL_DIR="$(mktemp -d)"; export BACKUP_DIR="$DRILL_DIR"
NAME="crm-drill-pg-$$"; PORT="${DRILL_PORT:-55432}"; PASS="$(openssl rand -hex 12)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$DRILL_DIR"; }
trap cleanup EXIT

SRC="${DATABASE_URL%%\?*}"
psql_src() { docker run --rm --network host postgres:16-alpine psql "$SRC" -Atc "$1"; }
psql_dst() { docker exec "$NAME" psql -U postgres -d crm_drill -Atc "$1"; }

echo "1) Backup sumber…"; "$(dirname "$0")/backup.sh"
FILE="$(ls "$DRILL_DIR"/crm-*.dump.enc | head -1)"

echo "2) Menyalakan Postgres terpisah (:$PORT)…"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PASS" -e POSTGRES_DB=crm_drill -p "127.0.0.1:$PORT:5432" postgres:16-alpine >/dev/null
for i in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres -d crm_drill >/dev/null 2>&1 && break; sleep 1; done

echo "3) Restore…"
"$(dirname "$0")/restore.sh" "$FILE" "postgresql://postgres:$PASS@127.0.0.1:$PORT/crm_drill"

echo "4) Verifikasi…"
fail=0
for t in organizations users members leads contacts companies deals deal_stage_history activities quotations quotation_items products feedbacks notifications tenant_connectors audit_logs _prisma_migrations; do
  a="$(psql_src "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo ERR)"
  b="$(psql_dst "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo ERR)"
  if [ "$a" = "$b" ] && [ "$a" != "ERR" ]; then printf '  OK   %-18s %s baris\n' "$t" "$a"; else printf '  GAGAL %-18s sumber=%s restore=%s\n' "$t" "$a" "$b"; fail=1; fi
done
[ "$fail" = 0 ] && echo "RESTORE DRILL BERHASIL" || { echo "RESTORE DRILL GAGAL" >&2; exit 1; }
