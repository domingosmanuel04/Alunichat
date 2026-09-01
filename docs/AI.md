# AI

## Goals

Alurichat AI assists agents and automates sales/support while keeping humans in control.

## Agents

Each **Agent** is tenant-scoped configuration:

- System prompt / persona
- Model provider (e.g. OpenAI via `OPENAI_API_KEY`)
- Allowed **tools**
- Linked **knowledge bases**
- Handoff rules (when to escalate to a human)

Agents run in a worker pipeline triggered by conversation events.

## Tools

Tools are typed functions the model may call, for example:

- `lookup_contact` / `update_contact`
- `search_knowledge`
- `create_ticket`
- `schedule_follow_up`
- `transfer_to_human`

Tool execution is permission-checked and audited. Side effects go through application services, never raw SQL.

## RAG

1. Documents uploaded to S3 and ingested into chunks.
2. Embeddings stored per `tenant_id` + knowledge base.
3. Retrieval at reply time: top-k chunks injected into the agent context.
4. Citations optionally returned in the API/UI.

## Safety

- Tenant isolation on vector/search indexes
- Prompt-injection awareness; tool allowlists
- Rate limits and max token budgets per plan tier
- Optional kill-switch per agent / tenant
