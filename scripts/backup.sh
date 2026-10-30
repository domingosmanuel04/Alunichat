#!/usr/bin/env bash
# MySQL backup helper (API endpoint or local mysqldump)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://127.0.0.1:4000}"
TOKEN="${PLATFORM_TOKEN:-}"
OUT_DIR="${BACKUP_DIR:-$ROOT/apps/api/backups}"

mkdir -p "$OUT_DIR"

if [[ -n "$TOKEN" ]]; then
  curl -sf -X POST "$API_URL/api/v1/platform/backup" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | tee /tmp/alurichat-backup.json
  echo
  exit 0
fi

DB_URL="${DATABASE_URL:-mysql://alurichat:alurichat@localhost:3311/alurichat}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$OUT_DIR/alurichat-$STAMP.sql"

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump missing — install MySQL client or set PLATFORM_TOKEN to call API backup"
  exit 1
fi

# Parse mysql://user:pass@host:port/db
proto_strip="${DB_URL#mysql://}"
userpass="${proto_strip%%@*}"
hostportdb="${proto_strip#*@}"
user="${userpass%%:*}"
pass="${userpass#*:}"
hostport="${hostportdb%%/*}"
db="${hostportdb#*/}"
db="${db%%\?*}"
host="${hostport%%:*}"
port="${hostport##*:}"
if [[ "$host" == "$port" ]]; then port=3306; fi

MYSQL_PWD="$pass" mysqldump \
  -h "$host" -P "$port" -u "$user" \
  --single-transaction --routines --triggers \
  "$db" > "$OUT"

echo "backup_ok:$OUT"
