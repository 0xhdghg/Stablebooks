# Stablebooks Production Env Checklist

## Document status

- Date: `2026-04-22`
- Scope: `Day 15 Slice 1`
- Status: `draft`

## Purpose

This checklist defines the environment required to run Stablebooks in a
production-like Postgres-backed mode.

It separates:

- required secrets
- safe public config
- runtime feature flags
- local/dev-only keys
- smoke-only variables

Do not commit real secrets in this repository.

## Target runtime posture

Production-like target:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
```

JSON fallback stays available during cutover, but the smoke target should use
Postgres-backed paths.

For hosted environments, JSON fallback should not be an accidental default.
Use it only with an explicit temporary override:

```env
STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=true
```

Optional enforcement control:

```env
STABLEBOOKS_ENFORCE_HOSTED_RUNTIME_POLICY=true
```

## API runtime

### Required

`DATABASE_URL`

- Postgres connection string.
- Secret.
- Must point at the intended environment database.
- Never commit.

`PORT`

- API listen port.
- Safe config.
- Default in code: `4000`.

### Readiness endpoints

Use:

```text
GET /api/v1/health/live
GET /api/v1/health/storage
GET /api/v1/health/postgres-workspace
```

Expected production-like storage posture:

- Postgres configured: yes
- Postgres reachable: yes
- migrations applied: yes
- `jsonStoreActive=false`
- `storageMode=postgres_reads`
- `postgresBackedRuntimeReady=true`
- `hostedRuntimePolicy.policyOk=true`
- `runtimeWriteModes.invoiceWriteMode=postgres`
- `runtimeWriteModes.paymentSessionWriteMode=postgres`
- `runtimeWriteModes.matchingWriteMode=postgres`
- `runtimeWriteModes.terminalPaymentWriteMode=postgres`
- `runtimeWriteModes.webhookWriteMode=postgres`

## Web runtime

`API_BASE_URL`

- Backend API base URL used by the Next.js app.
- Safe config unless it embeds credentials, which it should not.
- Example:

```env
API_BASE_URL=https://api.example.com/api/v1
```

Local default in code:

```env
API_BASE_URL=http://127.0.0.1:4000/api/v1
```

## Postgres-backed feature flags

Use these for production-like smoke:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
```

## Hosted fallback guardrails

`STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK`

- Optional.
- Default hosted posture should be unset/false.
- Set to `true` only for explicit temporary hosted rollback.

`STABLEBOOKS_ENFORCE_HOSTED_RUNTIME_POLICY`

- Optional.
- Default behavior is effectively enforced unless set to `false`.
- When enforced, hosted startup should fail if runtime falls back to JSON mode
  without the explicit hosted fallback override.

### Optional Arc evidence mirror

`STABLEBOOKS_ARC_EVIDENCE_MIRROR`

- Supported values:
  - `disabled`
  - `postgres_shadow`
  - `postgres_strict`
- Production-like target after cutover should prefer the normal Postgres
  matching path via `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`.
- `postgres_shadow` is useful for regression/safe mirror checks.

## Arc webhook-first provider config

Required for webhook-first provider ingestion:

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_WEBHOOK_SECRET=<secret-from-secret-store>
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=<monitored-token-or-contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
```

### Secrets

`ARC_WEBHOOK_SECRET`

- Secret.
- Must come from deployment secret storage.
- Must not be reused as outbound Stablebooks webhook secret.
- Must never be committed.

### Safe config

These are safe to document with placeholders:

- `ARC_SOURCE_ENABLED`
- `ARC_SOURCE_KIND`
- `ARC_CHAIN_ID`
- `ARC_EVENT_MONITOR_SOURCE`
- `ARC_EVENT_CONTRACT_ADDRESS`
- `ARC_EVENT_SIGNATURE`
- `ARC_EVENT_TOKEN_SYMBOL`
- `ARC_EVENT_TOKEN_DECIMALS`

Contract addresses may be public, but still use placeholders until final
deployment choices are confirmed.

## Arc polling config

Polling is not the first production-like mode.

Future-only variables:

```env
ARC_RPC_URL=<provider-url>
ARC_START_BLOCK=<deployment-start-block>
ARC_POLL_INTERVAL_MS=15000
ARC_CONFIRMATIONS_REQUIRED=1
```

Notes:

- `ARC_RPC_URL` can be secret if it contains a provider key.
- Polling requires the checkpoint strategy from
  `docs/arc-polling-checkpoint-strategy.md`.
- Do not enable polling without a durable checkpoint implementation.

## Outbound merchant webhook config

`STABLEBOOKS_WEBHOOK_URL`

- Merchant/operator webhook destination.
- Safe only if the URL does not contain embedded credentials.
- Empty value disables outbound delivery and creates disabled delivery records.

`STABLEBOOKS_WEBHOOK_SECRET`

- Secret.
- Used for outbound Stablebooks webhook signing.
- Must not be reused as `ARC_WEBHOOK_SECRET`.
- Current fallback exists for development only:
  `stablebooks-dev-webhook-secret`.

`STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS`

- Optional.
- Default in code: `4`.

`STABLEBOOKS_WEBHOOK_RETRY_BASE_MS`

- Optional.
- Default in code: `5000`.

`STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS`

- Optional.
- Default in code: `3000`.

## Smoke script config

### Production-like flow smoke

Script:

```text
corepack pnpm --filter @stablebooks/api smoke:production-flow -- --dry-run
corepack pnpm --filter @stablebooks/api smoke:production-flow
```

Required env:

```env
SMOKE_API_BASE_URL=<api-origin-with-/api/v1>
SMOKE_OPERATOR_TOKEN=<operator-session-token>
SMOKE_CUSTOMER_ID=<existing-customer-id>
SMOKE_SETTLEMENT_WALLET=<expected-collection-wallet>
ARC_WEBHOOK_SECRET=<secret-from-secret-store>
ARC_CHAIN_ID=5042002
ARC_EVENT_CONTRACT_ADDRESS=<monitored-token-or-contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
```

Optional env:

```env
SMOKE_AMOUNT_MINOR=10000
SMOKE_CURRENCY=USD
SMOKE_MEMO=<memo>
SMOKE_INTERNAL_NOTE=<internal-note>
SMOKE_DUE_AT=<iso-timestamp>
ARC_SMOKE_TX_HASH=<unique-test-tx-hash>
ARC_SMOKE_BLOCK_NUMBER=<block-number>
ARC_SMOKE_CONFIRMED_AT=<iso-timestamp>
ARC_SMOKE_FROM=<sender-address>
ARC_SMOKE_AMOUNT_ATOMIC=<atomic-token-amount>
```

The production-like flow smoke uses HTTP API only:

- `GET /health/storage`
- `POST /invoices`
- `POST /public/invoices/:publicToken/payment-session`
- `POST /arc/webhooks/events`
- `POST /arc/webhooks/finality`
- `GET /invoices/:invoiceId`
- `GET /payments/:paymentId`
- `GET /payments/webhook-deliveries?queue=all`

### Arc webhook smoke

Script:

```text
corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run
corepack pnpm --filter @stablebooks/api smoke:arc-webhook
```

Required env:

```env
ARC_WEBHOOK_BASE_URL=<api-origin-without-/api/v1>
ARC_WEBHOOK_SECRET=<secret-from-secret-store>
ARC_CHAIN_ID=5042002
ARC_EVENT_CONTRACT_ADDRESS=<monitored-token-or-contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
ARC_SMOKE_TO=<expected-collection-wallet>
```

Optional env:

```env
ARC_SMOKE_TX_HASH=<unique-test-tx-hash>
ARC_SMOKE_BLOCK_NUMBER=<block-number>
ARC_SMOKE_CONFIRMED_AT=<iso-timestamp>
ARC_SMOKE_FROM=<sender-address>
ARC_SMOKE_AMOUNT_ATOMIC=<atomic-token-amount>
```

## Development/test-only variables

Do not depend on these as production controls:

`ARC_DEV_INGEST_KEY`

- Protects dev-only Arc endpoints.
- Default fallback: `stablebooks-dev-arc-key`.
- Override in shared environments.
- Not production webhook auth.

`TEST_API_PORT`

- Used by Arc regression script.

`TEST_WEBHOOK_API_PORT`

- Used by webhook regression script.

`TEST_VERBOSE`

- Enables verbose test process logs.

## No-commit rules

Never commit:

- production `DATABASE_URL`
- `ARC_WEBHOOK_SECRET`
- provider API keys
- `ARC_RPC_URL` values containing API keys
- private keys
- `STABLEBOOKS_WEBHOOK_SECRET`
- merchant webhook secrets
- production `.env` files

Safe to commit:

- env var names
- example placeholders
- public testnet chain ids
- public docs URLs
- non-secret local examples

## Cutover checklist

Before a production-like smoke:

- Postgres is running and reachable.
- Migrations are applied.
- Seed/admin auth path exists for the operator.
- API starts with Postgres-backed flags.
- `/api/v1/health/storage` reports `postgresBackedRuntimeReady=true`.
- Web app points at the API via `API_BASE_URL`.
- Arc readiness is ready for webhook mode.
- Outbound webhook URL is either configured or intentionally empty.
- Smoke scripts use env variables only.

After a production-like smoke:

- Invoice is created through API.
- Hosted payment session is created through API.
- Provider webhook event is accepted.
- Payment reaches `processing`.
- Finality event moves payment to `finalized` or `failed`.
- Invoice status updates correctly.
- Webhook delivery record is created.
- Operator UI shows provider source diagnostics.

For the UI smoke checklist, see:

```text
docs/postgres-ui-smoke.md
```

For rollback controls, see:

```text
docs/production-rollback-strategy.md
```

For the Day 15 secrets/no-leak audit, see:

```text
docs/day-15-secrets-no-leak-audit.md
```
