# API conventions

Base path: **`/api/v1`**

## Request

- `Content-Type: application/json` (except multipart uploads)
- `Authorization: Bearer <access_token>`
- Optional: `X-Tenant-Id` when the token does not bind a single tenant
- `X-Request-Id` echoed when provided; otherwise generated

## Success response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

`meta` is optional; pagination fields appear on list endpoints.

## Error response

```json
{
  "success": false,
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "Conversation not found",
    "details": []
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

## HTTP status mapping

| Status | Use |
|--------|-----|
| 200 / 201 | Success |
| 400 | Validation |
| 401 | Unauthenticated |
| 403 | Forbidden (RBAC / tenant) |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limited |
| 500 | Unexpected |

## Versioning

Breaking changes ship under a new major prefix (`/api/v2`). Additive fields are non-breaking.

## Idempotency

Mutating endpoints that accept client retries support `Idempotency-Key` where documented (e.g. message send).
