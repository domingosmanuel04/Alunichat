# Integrations

## Adapter pattern

Channel and third-party providers are behind **adapters** implementing a shared port:

```ts
interface ChannelAdapter {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  normalizeWebhook(payload: unknown, headers: Record<string, string>): Promise<NormalizedEvent>;
  verifySignature?(rawBody: Buffer, headers: Record<string, string>): boolean;
}
```

Concrete adapters (examples):

| Adapter | Channel |
|---------|---------|
| `WhatsAppCloudAdapter` | Meta Cloud API |
| `WhatsAppBspAdapter` | BSP providers |
| `WebchatAdapter` | Embedded widget |
| `EmailAdapter` | SMTP / provider API |

## Registration

Adapters register in a factory keyed by `ChannelType`. The conversations module depends only on the port, not on vendor SDKs.

## Credentials

Stored encrypted in `ChannelCredential`; decrypted only inside the adapter/infrastructure layer.

## Extending

1. Add `ChannelType` in `@alurichat/shared` if needed.
2. Implement the adapter.
3. Register in the module factory.
4. Document webhook URL and verify token in [Webhooks.md](./Webhooks.md).
