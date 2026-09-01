#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "Stopping old API on :4000..."
pkill -f 'node dist/main.js' 2>/dev/null || true
fuser -k 4000/tcp 2>/dev/null || true
sleep 2
docker compose up -d
sleep 3
cd "$ROOT/apps/api"
pnpm exec tsc -p tsconfig.build.json --incremental false
: > /tmp/alurichat-api.log
nohup node dist/main.js >> /tmp/alurichat-api.log 2>&1 &
echo "API PID $!"
sleep 6
curl -sS http://127.0.0.1:4000/health; echo
grep -E 'Restoring|WhatsApp connected|QR ready|408|Wiped|successfully started' /tmp/alurichat-api.log | tail -20
echo "Done. Open Instâncias → Conectar and scan the QR if needed."
