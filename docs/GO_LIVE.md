# Go-live (VPS)

Checklist mínimo para pôr o Alurichat no ar com HTTPS automático.

## 1. Pré-requisitos no servidor

- Ubuntu 22.04+ (ou similar)
- Docker + Docker Compose plugin
- Portas **80** e **443** abertas
- Domínio com DNS:
  - `A` → `teu-dominio.com` → IP da VPS
  - `A` → `api.teu-dominio.com` → IP da VPS

## 2. Gerar secrets e env

No repositório:

```bash
pnpm prod:env teu-dominio.com admin@teu-dominio.com "O Teu Nome"
```

Isto cria:

- `.env.prod` (secrets fortes, mode 600)
- `.env.prod.credentials` (email/senha do Super Admin)

**Não commits estes ficheiros.** Guarda as credenciais offline.

Opcional: preenche `MAIL_SMTP_URL` em `.env.prod` para emails reais.

## 3. Deploy

```bash
pnpm prod:deploy
```

O script:

1. Build das imagens API/Web  
2. Sobe MySQL + Redis  
3. Corre `prisma migrate deploy`  
4. Bootstrap (planos + Super Admin — **sem** dados demo)  
5. Sobe API + Web + Caddy (HTTPS Let's Encrypt)

## 4. Verificar

```bash
curl -sf https://api.teu-dominio.com/health
curl -sf -o /dev/null -w '%{http_code}\n' https://teu-dominio.com/
```

Login: URL em `.env.prod.credentials`.

## 5. Operação

| Ação | Comando |
|------|---------|
| Logs | `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f` |
| Backup MySQL | `docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tools run --rm backup` |
| Restart | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d` |

## Regras de produção

- Nunca `pnpm db:seed` (bloqueado em `NODE_ENV=production`)
- Billing = comprovativo + aprovação em `/platform/signups`
- Swagger desligado; métricas com `METRICS_TOKEN`
- Comprovativos só via API autenticada

## WhatsApp

- **Baileys (QR):** volumes já montados; cria canal `ALURICHAT` na app  
- **Cloud API:** preenche `WHATSAPP_API_TOKEN` + `phoneNumberId` no canal `WHATSAPP_CLOUD`
