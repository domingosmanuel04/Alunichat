#!/usr/bin/env bash
# Generate a production .env.prod with strong random secrets.
# Usage: ./scripts/gen-env-prod.sh <domain> <admin-email> [admin-name]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ENV_OUT:-$ROOT/.env.prod}"

DOMAIN="${1:-}"
ADMIN_EMAIL="${2:-}"
ADMIN_NAME="${3:-Super Admin}"

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" ]]; then
  echo "Usage: $0 <domain> <admin-email> [admin-name]"
  echo "Example: $0 alurichat.makiratec.com admin@makiratec.com \"Domingos Manuel\""
  exit 1
fi

if [[ -f "$OUT" && "${FORCE:-}" != "1" ]]; then
  echo "Refusing to overwrite existing $OUT (set FORCE=1 to replace)"
  exit 1
fi

rand() { openssl rand -base64 48 | tr -d '\n/+=' | head -c 64; }
rand_pass() { openssl rand -base64 24 | tr -d '\n/+=' | head -c 24; }

MYSQL_PASSWORD="$(rand_pass)"
MYSQL_ROOT_PASSWORD="$(rand_pass)"
JWT_SECRET="$(rand)"
JWT_REFRESH_SECRET="$(rand)"
ENCRYPTION_KEY="$(rand)"
METRICS_TOKEN="$(rand_pass)$(rand_pass)"
ADMIN_PASSWORD="$(rand_pass)Aa1"

cat >"$OUT" <<EOF
NODE_ENV=production
DOMAIN=${DOMAIN}
ACME_EMAIL=${ADMIN_EMAIL}

WEB_URL=https://${DOMAIN}
NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
NEXT_PUBLIC_API_URL=https://api.${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}

MYSQL_USER=alurichat
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
MYSQL_DATABASE=alurichat
DATABASE_URL=mysql://alurichat:${MYSQL_PASSWORD}@mysql:3306/alurichat

REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

API_PORT=4000
ENABLE_SWAGGER=false
METRICS_TOKEN=${METRICS_TOKEN}
PLATFORM_NAME=Alurichat

BOOTSTRAP_ADMIN_EMAIL=${ADMIN_EMAIL}
BOOTSTRAP_ADMIN_PASSWORD=${ADMIN_PASSWORD}
BOOTSTRAP_ADMIN_NAME=${ADMIN_NAME}

MAIL_FROM="Alurichat <noreply@${DOMAIN}>"
MAIL_SMTP_URL=

WHATSAPP_API_URL=https://graph.facebook.com
WHATSAPP_API_VERSION=v21.0
WHATSAPP_API_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_WEBHOOK_SECRET=
WHATSAPP_SESSIONS_PATH=/app/apps/api/data/whatsapp-sessions
EOF

chmod 600 "$OUT"

CREDS_OUT="$ROOT/.env.prod.credentials"
cat >"$CREDS_OUT" <<EOF
# Generated $(date -u +%Y-%m-%dT%H:%MZ) — store securely, do not commit
DOMAIN=${DOMAIN}
WEB=https://${DOMAIN}
API=https://api.${DOMAIN}
SUPER_ADMIN_EMAIL=${ADMIN_EMAIL}
SUPER_ADMIN_PASSWORD=${ADMIN_PASSWORD}
METRICS_TOKEN=${METRICS_TOKEN}
EOF
chmod 600 "$CREDS_OUT"

echo "Wrote $OUT (mode 600)"
echo "Wrote $CREDS_OUT with login credentials — keep offline"
echo
echo "DNS required before deploy:"
echo "  A     ${DOMAIN}      -> VPS IP"
echo "  A     api.${DOMAIN}  -> VPS IP"
echo
echo "Next: pnpm prod:deploy"
