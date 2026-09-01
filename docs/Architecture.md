# Architecture

## Overview

Alurichat is a **pnpm + Turborepo monorepo** delivering a multi-tenant SaaS for omnichannel customer service, AI-assisted sales, and operational control.

```
ALURICHAT/
├── apps/
│   ├── api/          # NestJS — modular, clean architecture
│   └── web/          # Next.js — dashboard & inbox
├── packages/
│   ├── shared/       # Types, enums, API contracts
│   └── database/     # Prisma schema, migrations, seed
└── docs/
```

## Backend (NestJS)

- **Modular monolith**: bounded contexts as Nest modules (auth, tenants, conversations, channels, AI, billing, etc.).
- **Clean architecture**: controllers → application services / use-cases → domain → infrastructure (Prisma, Redis, S3, channel adapters).
- **Event-driven**: domain events published to an in-process bus and/or Redis streams for async workers (webhooks, AI jobs, notifications).
- **API versioning**: HTTP under `/api/v1`.

## Frontend (Next.js)

- App Router, server components where appropriate.
- Auth via JWT (access + refresh).
- Tenant context injected from session / subdomain / header.

## Multi-tenant data

**Shared database, shared schema** with `tenant_id` on every tenant-scoped row. Isolation is enforced in application middleware and query layers; PostgreSQL RLS is the planned hardening path (see [MultiTenant.md](./MultiTenant.md)).

## Cross-cutting concerns

| Concern | Approach |
|---------|----------|
| AuthZ | JWT + RBAC permission scopes |
| Secrets | Env vars; channel tokens encrypted at rest |
| Files | S3-compatible (MinIO locally) |
| Observability | Structured logs + request IDs (planned) |

## Package boundaries

- `@alurichat/shared` — zero I/O; types and constants only.
- `@alurichat/database` — Prisma client and migration scripts; consumed by the API.
- Apps depend on packages; packages must not depend on apps.
