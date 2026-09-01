# Deployment

## Local

```bash
docker compose up -d   # postgres, redis, minio
pnpm install
pnpm db:migrate
pnpm dev
```

## Docker (production-oriented)

Typical images (to be added with apps):

- `alurichat-api` — NestJS
- `alurichat-web` — Next.js
- `alurichat-worker` — queue consumers (optional split)

Compose or Swarm stacks inject env from secrets; never bake `.env` into images.

## Kubernetes overview

| Resource | Notes |
|----------|-------|
| Deployments | `api`, `web`, `worker` |
| Services | ClusterIP + Ingress (TLS) |
| Secrets | `DATABASE_URL`, JWT secrets, `ENCRYPTION_KEY`, S3, OpenAI |
| ConfigMaps | Non-secret config (`PLATFORM_NAME`, `API_PORT`, CORS) |
| PVC / managed | Postgres, Redis, object storage (prefer managed cloud services) |
| HPA | Scale API/workers on CPU / queue depth |

### Health

- API: `GET /health` (liveness), `GET /ready` (DB + Redis)
- Web: Next.js default / custom health route

### Migrations

Run Prisma migrate as a Job or init container before rolling out new API pods.

### Checklist

- [ ] TLS termination at Ingress
- [ ] Network policies between API and data stores
- [ ] Backup Postgres + S3 buckets
- [ ] Secret rotation runbook
- [ ] Observability (metrics, logs, traces)
