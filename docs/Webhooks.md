# Webhooks

## Inbound (channel → Alurichat)

1. Provider POSTs to `/api/v1/webhooks/:channel/:tenantOrChannelId`.
2. Verify **HMAC** (or provider-specific signature) using the channel webhook secret.
3. Reject invalid signatures with `401`.
4. Normalize via the channel adapter → domain events → persist messages / update conversation state.
5. Respond quickly (`200`); heavy work goes to async workers.

## Outbound (Alurichat → customer endpoints)

Tenants register `WebhookEndpoint` URLs with a signing secret.

### HMAC

```
X-Alurichat-Signature: sha256=<hmac_hex>
X-Alurichat-Timestamp: <unix_seconds>
```

Payload: raw JSON body. Signature over `timestamp + "." + body` using the endpoint secret.

### Retry policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | ~30s |
| 3 | ~2m |
| 4 | ~10m |
| 5 | ~1h |

After max attempts, mark delivery `failed` and surface in the dashboard. Idempotent consumers should key on `eventId`.

### Event envelope

```json
{
  "id": "evt_...",
  "type": "message.created",
  "tenantId": "uuid",
  "createdAt": "ISO-8601",
  "data": {}
}
```
