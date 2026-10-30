# Alurichat

**Atendimento inteligente. Vendas automatizadas. Operação sob controle.**

Plataforma SaaS multi-tenant de atendimento omnichannel, CRM, Kanban, automações, agentes de IA, campanhas, agendamentos e analytics.

---

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces + Turborepo |
| API | NestJS + TypeScript (`apps/api`) |
| Web | Next.js 15 + React 19 (`apps/web`) |
| DB | MySQL + Prisma (`packages/database`) |
| Shared | Types / permissions (`packages/shared`) |
| Cache / queues | Redis + BullMQ |
| Realtime | Socket.IO |

## Prerequisites

- Node.js >= 20
- pnpm 9.15.0 (`corepack enable`)
- Docker & Docker Compose

## Quick start

### 1. Infrastructure

```bash
docker compose up -d
```

| Service | Host port |
|---------|-----------|
| MySQL | `3311` |
| Redis | `6381` |

### 2. Environment

```bash
cp .env.example .env
```

### 3. Install, migrate, seed, run

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

| App | URL |
|-----|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger | http://localhost:4000/api/docs |
| Health | http://localhost:4000/health |

### Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `dpmanuel95@gmail.com` | `Manuel@121@` |

Cadastros públicos ficam pendentes até o Super Admin aprovar em `/platform/signups` e definir a senha do owner.

## Production (go-live)

Guia completo: **[docs/GO_LIVE.md](docs/GO_LIVE.md)**

```bash
pnpm prod:env teu-dominio.com admin@teu-dominio.com
# DNS: teu-dominio.com + api.teu-dominio.com → VPS
pnpm prod:deploy
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | API + Web em watch |
| `pnpm build` | Build de todos os packages |
| `pnpm lint` | Typecheck / lint |
| `pnpm db:migrate` | Prisma migrate deploy |
| `pnpm db:bootstrap` | Planos + Super Admin (produção) |
| `pnpm db:seed` | Seed demo (bloqueado em production) |
| `pnpm db:generate` | Prisma client |
| `pnpm prod:env` | Gerar `.env.prod` com secrets |
| `pnpm prod:deploy` | Deploy Docker + Caddy HTTPS |

## Documentation

- [Go-live](docs/GO_LIVE.md)
- [Architecture](docs/Architecture.md)
- [Multi-tenant](docs/MultiTenant.md)
- [Security](docs/Security.md)
- [API](docs/API.md)
- [Database](docs/Database.md)
- [AI](docs/AI.md)
- [Integrations](docs/Integrations.md)
- [Webhooks](docs/Webhooks.md)
- [Deployment](docs/Deployment.md)

## License

Proprietary — Makira.tec / Alurichat
