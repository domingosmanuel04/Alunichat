# Deployment

## Local (dev)

```bash
docker compose up -d   # mysql :3311, redis :6381
pnpm install
pnpm db:migrate
pnpm db:seed           # demo only — never in production
pnpm dev
```

## Production (go-live)

See **[GO_LIVE.md](./GO_LIVE.md)** for the full VPS checklist.

```bash
pnpm prod:env teu-dominio.com admin@teu-dominio.com
pnpm prod:deploy
```

Stack (`docker-compose.prod.yml`):

| Service | Role |
|---------|------|
| `mysql` / `redis` | Internal only |
| `api` / `web` | Internal only |
| `proxy` (Caddy) | Public `:80` / `:443` + Let's Encrypt |
| `migrate` / `bootstrap` / `backup` | `--profile tools` |

Images: `apps/api/Dockerfile`, `apps/web/Dockerfile` (Next standalone).

## Backups

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tools run --rm backup
# or
PLATFORM_TOKEN=... ./scripts/backup.sh
```

## Health

- `GET https://api.<domain>/health`
- `GET https://api.<domain>/ready`
- `GET https://api.<domain>/metrics` + `Authorization: Bearer $METRICS_TOKEN`
