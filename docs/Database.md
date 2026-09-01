# Database

Prisma lives in `@alurichat/database`. Connection string: `DATABASE_URL`.

## Entity overview

| Entity | Purpose |
|--------|---------|
| **Tenant** | Organization / workspace; plan tier, status |
| **User** | Login identity; may belong to one or more tenants |
| **Membership** | User ↔ Tenant + role |
| **Role / Permission** | RBAC definitions |
| **Contact** | Customer / lead profile (`tenant_id`) |
| **Conversation** | Thread across a channel; status lifecycle |
| **Message** | Inbound/outbound content; direction, status |
| **Channel** | WhatsApp, Instagram, webchat, email, etc. |
| **ChannelCredential** | Encrypted tokens / config per channel |
| **Agent** | AI agent config (model, tools, system prompt) |
| **KnowledgeBase / Document** | RAG corpora and chunks |
| **Automation / Workflow** | Rules and sequences |
| **Ticket / Assignment** | Human handoff queues |
| **Billing / Subscription** | Plan, seats, usage |
| **WebhookEndpoint** | Outbound webhook destinations |
| **WebhookDelivery** | Delivery attempts & status |
| **AuditLog** | Security / compliance trail |
| **MediaAsset** | S3 object references |

All tenant-scoped entities include `tenant_id`, `created_at`, `updated_at`. Soft-delete via `deleted_at` where applicable.

## Scripts

```bash
pnpm db:generate   # prisma generate
pnpm db:migrate    # prisma migrate
pnpm db:seed       # seed demo tenant / users
```

## Conventions

- UUIDs as primary keys
- Indexes on `(tenant_id, …)` for hot query paths
- Enums aligned with `@alurichat/shared` (`PlanTier`, `ChannelType`, `ConversationStatus`, …)
