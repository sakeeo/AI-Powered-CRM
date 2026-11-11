#!/usr/bin/env bash
# Health check untuk monitor eksternal / cron. Exit 0 = sehat, 1 = bermasalah.
# Contoh cron tiap menit dengan notifikasi: * * * * * /opt/crm/scripts/healthcheck.sh https://crm.contoh.com || curl -fsS -d "CRM DOWN" https://ntfy.sh/topik-anda
set -euo pipefail
URL="${1:?URL dasar wajib, mis. https://crm.contoh.com}"
out="$(curl -fsS --max-time 10 "$URL/api/health")" || { echo "GAGAL: $URL/api/health tidak merespons 200" >&2; exit 1; }
echo "$out"
