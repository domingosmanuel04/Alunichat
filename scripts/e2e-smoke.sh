#!/usr/bin/env bash
# Basic E2E critical path: health → web → super-admin login → analytics
set -euo pipefail
API="${API_URL:-http://127.0.0.1:4000}"
WEB="${WEB_URL:-http://127.0.0.1:3000}"
EMAIL="${SMOKE_EMAIL:-dpmanuel95@gmail.com}"
PASSWORD="${SMOKE_PASSWORD:-Manuel@121@}"

echo "== API health =="
curl -sf "$API/health" | head -c 200
echo

echo "== Discovery files =="
for path in /llms.txt /roots.txt /sitemap.xml /robots.txt; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$WEB$path" || true)
  echo "web$path:$code"
done

echo "== Web landing =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$WEB/" || true)
echo "web_status:$code"

echo "== Login super admin =="
login=$(curl -sf -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
token=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print((d.get('data') or d).get('accessToken',''))" "$login")
test -n "$token"
echo "login_ok"

echo "== Platform health =="
curl -sf "$API/api/v1/platform/health" \
  -H "Authorization: Bearer $token" | head -c 180
echo

echo "== Checkout disabled =="
code=$(curl -s -o /tmp/checkout.json -w "%{http_code}" -X POST "$API/api/v1/payments/checkout" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"planName":"PRO"}' || true)
echo "checkout_status:$code"
grep -q 'CHECKOUT_DISABLED\|Gone\|410\|403\|401' /tmp/checkout.json && echo checkout_blocked_ok || echo "checkout_body:$(head -c 120 /tmp/checkout.json)"

echo "e2e smoke ok"
