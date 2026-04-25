# Stablebooks Arc Production Setup

## Document status

- Date: `2026-04-22`
- Scope: `Arc provider environment contract`
- Status: `updated through Day 14 Slice 1`

## Recommended mode

Use webhook-first Arc ingestion for the first production-like integration.

Reason:

- Stablebooks already exposes Arc webhook endpoints.
- Arc/Circle event monitor style payloads fit push-based ingestion.
- The payment runtime already handles canonical evidence once normalized.
- RPC/indexer polling can be added later behind a separate checkpoint strategy.

## Runtime modes

### Disabled

Use for local development when Arc provider ingestion should not accept external
callbacks.

```env
ARC_SOURCE_ENABLED=false
```

### Webhook-first

Recommended first production-like mode.

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_WEBHOOK_SECRET=<secret-from-deployment-secret-store>
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=<monitored-token-or-contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
```

Expected inbound endpoints:

- `POST /api/v1/arc/webhooks/events`
- `POST /api/v1/arc/webhooks/finality`

Expected inbound header:

- `x-arc-webhook-secret: <ARC_WEBHOOK_SECRET>`

### RPC polling

Future mode. Do not use as the first production integration unless webhook
delivery from the provider is unavailable.

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=rpc_polling
ARC_CHAIN_ID=5042002
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_START_BLOCK=<deployment-start-block>
ARC_POLL_INTERVAL_MS=15000
ARC_CONFIRMATIONS_REQUIRED=1
```

Polling modes require a durable checkpoint before production use. See
`docs/arc-polling-checkpoint-strategy.md`.

### Indexer polling

Future mode. Use only after choosing a specific indexer/provider contract.

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=indexer_polling
ARC_CHAIN_ID=5042002
ARC_RPC_URL=<indexer-or-provider-url>
ARC_START_BLOCK=<deployment-start-block>
ARC_POLL_INTERVAL_MS=15000
ARC_CONFIRMATIONS_REQUIRED=1
```

Indexer polling should use the same checkpoint strategy as RPC polling, scoped
by provider, chain id, contract address, and event signature.

## Arc provider variables

### Required today

`ARC_SOURCE_ENABLED`

- `true` enables Arc provider ingestion checks.
- `false` disables production Arc webhook ingestion.
- Default in code: `false`.

`ARC_SOURCE_KIND`

- Supported values:
  - `webhook`
  - `rpc_polling`
  - `indexer_polling`
  - `fixtures`
- Recommended first mode: `webhook`.
- Current code default: `rpc_polling`.

`ARC_CHAIN_ID`

- Required when Arc source is enabled.
- Current Arc testnet value: `5042002`.
- Must be rechecked before mainnet/beta deployment.

### Required for webhook mode

`ARC_WEBHOOK_SECRET`

- Required when `ARC_SOURCE_KIND=webhook`.
- Used by the current API as the `x-arc-webhook-secret` header value.
- Must come from deployment secret storage.
- Must not be committed.

### Required provider source profile for webhook mode

`ARC_EVENT_MONITOR_SOURCE`

- Identifies the upstream event monitor profile.
- Suggested first value: `circle_contracts_api`.
- Not treated as a secret.

`ARC_EVENT_CONTRACT_ADDRESS`

- Expected monitored token or contract address.
- Used by the provider source profile.
- Provider payloads from unexpected contracts are rejected before canonical
  ingestion.

`ARC_EVENT_SIGNATURE`

- Expected event signature.
- First expected value: `Transfer(address,address,uint256)`.
- Provider payloads from unexpected events are rejected before canonical
  ingestion.

`ARC_EVENT_TOKEN_SYMBOL`

- Expected token symbol for canonical payment events.
- First expected value: `USDC`.
- Normalized to uppercase by config.
- Provider payloads with a different token are rejected before canonical
  ingestion.

`ARC_EVENT_TOKEN_DECIMALS`

- Expected token decimals.
- First expected value: `6`.
- Provider payloads with different decimals are rejected before canonical
  ingestion.

### Required for polling modes

`ARC_RPC_URL`

- Required when `ARC_SOURCE_KIND=rpc_polling` or `indexer_polling`.
- Current Arc testnet public RPC: `https://rpc.testnet.arc.network`.
- For production, prefer a managed provider or dedicated infrastructure.
- Treat provider URLs with API keys as secrets.

`ARC_START_BLOCK`

- Optional in current code.
- Required operationally for safe polling.
- Should be set to the block where the deployment starts monitoring.

`ARC_POLL_INTERVAL_MS`

- Optional.
- Current code default: `15000`.

`ARC_CONFIRMATIONS_REQUIRED`

- Optional.
- Current code default: `1`.
- Arc has deterministic sub-second finality, but keep this knob for provider
  compatibility and future non-webhook modes.

### Development-only

`ARC_DEV_INGEST_KEY`

- Protects dev-only Arc ingest/readiness endpoints.
- Current fallback: `stablebooks-dev-arc-key`.
- Override in shared/staging environments.
- Do not use as production webhook authentication.

## Stablebooks runtime flags

Use the Postgres-backed runtime when testing real provider integration:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
```

Keep JSON fallback available until production storage migration is complete.

## Outbound merchant webhook variables

These are separate from Arc provider ingestion.

`STABLEBOOKS_WEBHOOK_URL`

- Outbound merchant/operator webhook destination.
- Used by Stablebooks to notify merchants about `payment.finalized` and
  `payment.failed`.

`STABLEBOOKS_WEBHOOK_SECRET`

- Outbound Stablebooks webhook signing secret.
- Must not be reused as `ARC_WEBHOOK_SECRET`.

`STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS`

- Optional.
- Current default: `4`.

`STABLEBOOKS_WEBHOOK_RETRY_BASE_MS`

- Optional.
- Current default: `5000`.

`STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS`

- Optional.
- Current default: `3000`.

## Readiness behavior

Current readiness endpoint:

- `GET /api/v1/arc/dev/readiness`

Current readiness auth:

- `x-arc-dev-key: <ARC_DEV_INGEST_KEY>`

Expected behavior:

- If `ARC_SOURCE_ENABLED=false`, readiness can be `ready=true` even when Arc
  provider config is absent.
- If `ARC_SOURCE_ENABLED=true`, readiness must require `ARC_CHAIN_ID`.
- If source kind is `webhook`, readiness must require `ARC_WEBHOOK_SECRET`.
- If source kind is `rpc_polling` or `indexer_polling`, readiness must require
  `ARC_RPC_URL`.
- Readiness must never echo secret values.

Current behavior:

- readiness exposes `hasRpcUrl` and `hasWebhookSecret` booleans
- readiness does not expose raw `rpcUrl` or `webhookSecret` values
- regression coverage verifies that secret/url values are not present in the
  readiness response

## Secrets policy

Never commit:

- `ARC_WEBHOOK_SECRET`
- provider API keys
- production `ARC_RPC_URL` values that contain API keys
- private keys
- `STABLEBOOKS_WEBHOOK_SECRET`
- merchant webhook secrets
- production database URLs

Safe to document:

- public Arc testnet chain id
- public Arc testnet RPC URL
- public Arc testnet explorer URL
- variable names
- example placeholders

## Local webhook-first example

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_WEBHOOK_SECRET=replace-me-local-secret
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6

STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
```

Then send provider-shaped test payloads to:

```text
POST /api/v1/arc/webhooks/events
POST /api/v1/arc/webhooks/finality
```

with:

```text
x-arc-webhook-secret: replace-me-local-secret
```

## Production-like webhook smoke

Use this smoke script against local or staging webhook-first deployments:

```powershell
$env:ARC_WEBHOOK_BASE_URL="http://127.0.0.1:4000"
$env:ARC_WEBHOOK_SECRET="replace-me-local-secret"
$env:ARC_CHAIN_ID="5042002"
$env:ARC_EVENT_CONTRACT_ADDRESS="0x0000000000000000000000000000000000000001"
$env:ARC_EVENT_SIGNATURE="Transfer(address,address,uint256)"
$env:ARC_EVENT_TOKEN_SYMBOL="USDC"
$env:ARC_EVENT_TOKEN_DECIMALS="6"
$env:ARC_SMOKE_TO="<expected-collection-wallet>"
corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run
corepack pnpm --filter @stablebooks/api smoke:arc-webhook
```

The script:

- reads all secrets/config from env
- commits no real secrets
- sends a Circle/Event Monitor-style decoded payload to
  `/api/v1/arc/webhooks/events`
- prints provider diagnostics, match result, and payment status

Optional smoke env vars:

- `ARC_SMOKE_TX_HASH`
- `ARC_SMOKE_BLOCK_NUMBER`
- `ARC_SMOKE_CONFIRMED_AT`
- `ARC_SMOKE_FROM`
- `ARC_SMOKE_AMOUNT_ATOMIC`

## Day 13 next implementation notes

Slice 3 should harden readiness output.

Slice 4 should create or clarify the provider adapter boundary:

- webhook provider decoder
- canonical event handoff
- polling modes kept separate

Slice 5 should add provider-shaped payload regression coverage.

Slice 6 should keep polling implementation deferred, but document the durable
checkpoint strategy required before enabling `rpc_polling` or
`indexer_polling`.

## Day 14 implementation notes

Slice 1 added the provider source profile to runtime config and safe readiness
output.

Slice 2 enforces the profile against inbound Circle/Event Monitor provider
payloads before canonical ingestion.

Slice 3 added provider diagnostics to API responses:

- successful provider responses include `providerBoundary` and
  `providerDiagnostic`
- accepted Circle/Event Monitor payloads report `sourceProfileMatched=true`
- canonical/dev payloads report `sourceProfileMatched=null`
- rejected provider payloads include a safe `rejectedReason`
- diagnostics do not echo secrets or raw provider payloads

Slice 4 made provider diagnostics operator-visible:

- payment detail API responses expose safe `providerDiagnostic`
- invoice detail responses expose the same signal through latest payment records
- operator UI shows provider boundary, source kind, profile match status, and
  warnings
- UI still avoids displaying raw provider payloads

Slice 5 added a production-like webhook smoke script:

- `corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run`
- `corepack pnpm --filter @stablebooks/api smoke:arc-webhook`
