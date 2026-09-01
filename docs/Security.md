# Security

## Authentication

- **Access JWT** — short-lived; claims include `sub` (user id), `tenantId`, `roles`, `permissions`.
- **Refresh JWT** — longer-lived; stored hashed server-side (or rotated); separate secret (`JWT_REFRESH_SECRET`).
- Passwords hashed with **bcrypt** (cost ≥ 10).

## Authorization (RBAC)

Permission scopes are fine-grained strings (see `@alurichat/shared`). Examples:

- `conversations:read` / `conversations:write`
- `contacts:read` / `contacts:write`
- `settings:manage`
- `billing:manage`
- `platform:admin`

Roles map to sets of scopes. Guards check required scopes on every protected route.

## Encryption

| Data | Method |
|------|--------|
| Channel API tokens, webhook secrets | AES-256-GCM with `ENCRYPTION_KEY` |
| Transit | TLS in production |
| At rest (DB / S3) | Provider disk encryption + app-level for secrets |

Never log decrypted secrets or full JWTs.

## Audit

- Append-only **audit log** per tenant: actor, action, resource, metadata, IP, timestamp.
- Auth failures, permission denials, and cross-tenant admin actions are always audited.

## Hardening checklist

- [ ] Rotate JWT secrets and encryption keys via runbook
- [ ] Rate-limit auth and webhook endpoints
- [ ] Validate webhook HMAC before processing
- [ ] CORS allowlist (`CORS_ORIGIN`)
- [ ] Principle of least privilege for DB and S3 credentials
