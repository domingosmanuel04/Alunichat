#!/usr/bin/env bash
# Smoke checks for critical ALURICHAT flows
set -euo pipefail
API="${API_URL:-http://127.0.0.1:4000}"

echo "== health =="
curl -sf "$API/health" | head -c 200; echo

echo "== plans (public) =="
curl -sf "$API/api/v1/billing/plans" | head -c 120; echo

echo "== register validation =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/v1/auth/register")
test "$code" = "400" -o "$code" = "401" && echo "register_guard:$code ok"

echo "== forgot-password =="
curl -sf -X POST "$API/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.com"}' | head -c 200; echo

echo "smoke ok"
