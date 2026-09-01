#!/usr/bin/env bash
# Scheduled / manual backup helper
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://127.0.0.1:4000}"
TOKEN="${PLATFORM_TOKEN:-}"

mkdir -p "$ROOT/apps/api/backups"

if [[ -n "$TOKEN" ]]; then
  curl -sf -X POST "$API_URL/api/v1/platform/backup" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | tee /tmp/alurichat-backup.json
  echo
  exit 0
fi

# Local pg_dump fallback
DB_URL="${DATABASE_URL:-postgresql://alurichat:alurichat@localhost:5437/alurichat}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$ROOT/apps/api/backups/alurichat-$STAMP.sql"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump --no-owner --no-acl --dbname "$DB_URL" -f "$OUT"
  echo "backup_ok:$OUT"
else
  echo "pg_dump missing — use PLATFORM_TOKEN to call API backup endpoint"
  exit 1
fi
