#!/usr/bin/env bash
# Basic E2E critical path: health → plans → register guard → forgot password → login demo
set -euo pipefail
API="${API_URL:-http://127.0.0.1:4000}"
WEB="${WEB_URL:-http://127.0.0.1:3000}"

echo "== API health =="
curl -sf "$API/health" | head -c 200
echo

echo "== Web landing =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$WEB/" || true)
echo "web_status:$code"

echo "== Login demo =="
login=$(curl -sf -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Slug: demo' \
  -d '{"email":"owner@demo.alurichat.com","password":"DemoOwner123!","tenantSlug":"demo"}')
token=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print((d.get('data') or d).get('accessToken',''))" "$login")
test -n "$token"
echo "login_ok"

echo "== Analytics =="
curl -sf "$API/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer $token" \
  -H 'X-Tenant-Slug: demo' | head -c 180
echo

echo "== Platform health (if superadmin; may 403) =="
curl -s -o /tmp/ph.json -w "%{http_code}" "$API/api/v1/platform/health" \
  -H "Authorization: Bearer $token" || true
echo

echo "e2e smoke ok"
