# Multi-tenant strategy

## Model

Alurichat uses a **shared database / shared schema** model:

- One PostgreSQL database for all tenants.
- Every tenant-scoped table includes `tenant_id` (UUID FK → `Tenant`).
- Global tables (e.g. platform feature flags) omit `tenant_id`.

## Isolation layers

### 1. Application middleware (required, day one)

1. Resolve tenant from JWT claim, `X-Tenant-Id` header, or subdomain.
2. Attach `tenantId` to request context (AsyncLocalStorage / Nest CLS).
3. All repositories **must** filter by `tenantId`; never trust client-supplied IDs alone for cross-tenant reads.

### 2. Query conventions

- Prefer Prisma middleware / extensions that inject `tenant_id` on `findMany`, `update`, `delete`.
- Soft-delete and audit rows inherit the same `tenant_id`.

### 3. RLS evolution (phase 2)

Enable PostgreSQL Row Level Security:

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

The API sets `SET LOCAL app.tenant_id = '...'` per transaction after auth.

RLS is a **defense-in-depth** layer; application filters remain mandatory.

## Tenant lifecycle

| Stage | Notes |
|-------|-------|
| Provision | Create `Tenant` + default roles/permissions + optional seed inbox |
| Suspend | Block auth / API; data retained |
| Offboard | Soft-delete → hard-delete after retention window |

## Super-admin

Platform operators may act across tenants via elevated scopes (`platform:*`). Cross-tenant access must be audited.
