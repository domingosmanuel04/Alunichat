#!/usr/bin/env bash
# Build and deploy the production stack (migrate → bootstrap → up).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Run first: pnpm prod:env <domain> <admin-email>"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# Export vars for compose interpolation
# (compose --env-file already loads for containers; host-side ${VAR:?} needs export)
source "$ENV_FILE"
set +a

required=(DOMAIN ACME_EMAIL MYSQL_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY METRICS_TOKEN CORS_ORIGIN WEB_URL NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required var in $ENV_FILE: $key"
    exit 1
  fi
done

echo "== DNS reminder =="
echo "  A  ${DOMAIN}      -> this server"
echo "  A  api.${DOMAIN}  -> this server"
echo

echo "== Build images =="
"${COMPOSE[@]}" build

echo "== Start MySQL + Redis =="
"${COMPOSE[@]}" up -d mysql redis

echo "== Wait for MySQL =="
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent 2>/dev/null; then
    echo "mysql_ok"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "MySQL did not become healthy in time"
    exit 1
  fi
  sleep 2
done

echo "== Migrate =="
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "== Bootstrap super admin + plans =="
"${COMPOSE[@]}" --profile tools run --rm bootstrap

echo "== Start API + Web + Caddy =="
"${COMPOSE[@]}" up -d api web proxy

echo
echo "Deploy started."
echo "  Web: https://${DOMAIN}"
echo "  API: https://api.${DOMAIN}/health"
echo "  Login: see .env.prod.credentials"
echo
echo "Logs: docker compose -f docker-compose.prod.yml --env-file $ENV_FILE logs -f proxy api web"
echo "Backup: docker compose -f docker-compose.prod.yml --env-file $ENV_FILE --profile tools run --rm backup"
