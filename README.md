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
| DB | PostgreSQL + Prisma (`packages/database`) |
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
| PostgreSQL | `5437` |
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

### Demo credentials (after seed)

| Role | Email | Password | Tenant |
|------|-------|----------|--------|
| Super Admin | `superadmin@alurichat.com` | `SuperAdmin123!` | — |
| Owner | `owner@demo.alurichat.com` | `DemoOwner123!` | `demo` |
| Agent | `agent@demo.alurichat.com` | `DemoAgent123!` | `demo` |

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | API + Web em watch |
| `pnpm build` | Build de todos os packages |
| `pnpm lint` | Typecheck / lint |
| `pnpm db:migrate` | Prisma migrate |
| `pnpm db:seed` | Seed demo |
| `pnpm db:generate` | Prisma client |

## Documentation

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
