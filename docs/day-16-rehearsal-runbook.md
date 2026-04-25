# Stablebooks Day 16 Rehearsal Runbook

## Document status

- Date: `2026-04-22`
- Scope: `Day 16 Slice 1`
- Status: `draft`

## Purpose

This runbook describes the repeatable local/staging-like rehearsal for the
production runtime.

The rehearsal proves that Stablebooks can run the canonical flow through
Postgres-backed API paths and that the operator UI can inspect the result:

```text
invoice created
-> hosted payment session created
-> Arc provider webhook accepted
-> payment finalized
-> invoice paid
-> webhook delivery created
-> operator UI shows the evidence
```

## Preconditions

Required local services:

- Postgres running locally
- Node/pnpm dependencies installed

Expected local database URL:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/stablebooks?schema=public
```

The current local API workspace already has this value in `apps/api/.env`.
Do not commit production `.env` files or real deployment secrets.

## Seed fixtures used by the rehearsal

The default seed provides:

- operator email: `operator@stablebooks.dev`
- operator password: `stablebooks123`
- smoke operator token:
  `sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484`
- customer id: `cus_seed_acme`
- settlement wallet:
  `0x1111111111111111111111111111111111111111`

These are local/dev fixtures only.

## Step 1: migrate and seed Postgres

From repo root:

```powershell
corepack pnpm --filter @stablebooks/api exec prisma migrate deploy
corepack pnpm --filter @stablebooks/api db:seed
```

If the local database is intentionally being rebuilt during development, this
alternative is acceptable:

```powershell
corepack pnpm --filter @stablebooks/api db:migrate:dev
corepack pnpm --filter @stablebooks/api db:seed
```

Success criteria:

- migrations finish without errors
- seed finishes without errors

## Step 2: start API in production-runtime mode

Use a dedicated PowerShell terminal.

```powershell
$env:PORT="4000"
$env:STABLEBOOKS_STORAGE_MODE="postgres_reads"
$env:STABLEBOOKS_INVOICE_WRITE_MODE="postgres"
$env:STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE="postgres"
$env:STABLEBOOKS_MATCHING_WRITE_MODE="postgres"
$env:STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE="postgres"
$env:STABLEBOOKS_WEBHOOK_WRITE_MODE="postgres"
$env:ARC_SOURCE_ENABLED="true"
$env:ARC_SOURCE_KIND="webhook"
$env:ARC_CHAIN_ID="5042002"
$env:ARC_WEBHOOK_SECRET="replace-me-local-only"
$env:ARC_EVENT_MONITOR_SOURCE="circle_contracts_api"
$env:ARC_EVENT_CONTRACT_ADDRESS="0x6666666666666666666666666666666666666666"
$env:ARC_EVENT_SIGNATURE="Transfer(address,address,uint256)"
$env:ARC_EVENT_TOKEN_SYMBOL="USDC"
$env:ARC_EVENT_TOKEN_DECIMALS="6"
$env:STABLEBOOKS_WEBHOOK_URL=""
corepack pnpm --filter @stablebooks/api build
corepack pnpm --filter @stablebooks/api start
```

Notes:

- `ARC_WEBHOOK_SECRET=replace-me-local-only` is a local placeholder.
- Empty `STABLEBOOKS_WEBHOOK_URL` intentionally creates disabled webhook
  deliveries instead of calling a real merchant endpoint.

## Step 3: verify API readiness

Use another PowerShell terminal.

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/v1/health/live
Invoke-RestMethod http://127.0.0.1:4000/api/v1/health/storage
```

Expected storage readiness:

- `postgresBackedRuntimeReady=true`
- `jsonStoreActive=false`
- `postgres.configured=true`
- `postgres.reachable=true`
- `runtimeWriteModes.invoiceWriteMode=postgres`
- `runtimeWriteModes.paymentSessionWriteMode=postgres`
- `runtimeWriteModes.matchingWriteMode=postgres`
- `runtimeWriteModes.terminalPaymentWriteMode=postgres`
- `runtimeWriteModes.webhookWriteMode=postgres`

If readiness fails, do not run the smoke yet.

## Step 4: run production flow smoke

Use the same secondary PowerShell terminal.

```powershell
$env:SMOKE_API_BASE_URL="http://127.0.0.1:4000/api/v1"
$env:SMOKE_OPERATOR_TOKEN="sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484"
$env:SMOKE_CUSTOMER_ID="cus_seed_acme"
$env:SMOKE_SETTLEMENT_WALLET="0x1111111111111111111111111111111111111111"
$env:ARC_WEBHOOK_SECRET="replace-me-local-only"
$env:ARC_CHAIN_ID="5042002"
$env:ARC_EVENT_CONTRACT_ADDRESS="0x6666666666666666666666666666666666666666"
$env:ARC_EVENT_SIGNATURE="Transfer(address,address,uint256)"
$env:ARC_EVENT_TOKEN_SYMBOL="USDC"
$env:ARC_EVENT_TOKEN_DECIMALS="6"
corepack pnpm --filter @stablebooks/api smoke:production-flow
```

Capture from output:

- `invoiceId`
- `paymentId`
- `invoiceStatus`
- `paymentStatus`
- `webhookDeliveryStatus`

Expected smoke output:

- `ok=true`
- `invoiceStatus=paid`
- `paymentStatus=finalized`
- `matchResult=exact`
- provider diagnostic has `sourceProfileMatched=true`
- webhook delivery exists

## Step 5: start Web UI

Use a third PowerShell terminal.

```powershell
$env:API_BASE_URL="http://127.0.0.1:4000/api/v1"
corepack pnpm --filter @stablebooks/web build
corepack pnpm --filter @stablebooks/web start
```

Open:

```text
http://127.0.0.1:3000/signin
```

Sign in with:

- email: `operator@stablebooks.dev`
- password: `stablebooks123`

## Step 6: manual UI checks

Use the captured smoke IDs.

Invoice detail:

```text
http://127.0.0.1:3000/invoices/<invoiceId>
```

Expected:

- invoice status is `paid`
- latest payment is `finalized`
- provider source card is present
- source profile is matched
- onchain fields are visible

Payment detail:

```text
http://127.0.0.1:3000/payments/<paymentId>
```

Expected:

- payment status is `finalized`
- tx hash/block/token/amount are visible
- source confirmation fields are visible
- provider diagnostics are visible
- webhook delivery card exists

Webhook queue:

```text
http://127.0.0.1:3000/webhooks
```

Expected:

- `payment.finalized` delivery is visible
- status is `disabled` when `STABLEBOOKS_WEBHOOK_URL=""`

Hosted payment page:

```text
http://127.0.0.1:3000/pay/<publicToken>
```

Expected:

- paid/finalized invoice is terminal/success-safe
- customer-facing page does not expose operator diagnostics

## Step 7: cleanup / rollback

Stop API and Web with `Ctrl+C` in their terminals.

If the rehearsal data should be reset:

```powershell
corepack pnpm --filter @stablebooks/api db:seed
```

Do not delete Postgres evidence manually during a real cutover rehearsal unless
the test database is intentionally disposable.

## Failure signs

Investigate before continuing if:

- storage readiness is not `postgresBackedRuntimeReady=true`
- smoke fails before invoice creation
- provider profile does not match
- payment does not finalize
- invoice does not become `paid`
- webhook delivery is missing
- UI cannot find the smoke-created invoice/payment
- UI shows JSON fallback seed data instead of Postgres-backed smoke data

## Related docs

- `docs/day-16-execution-plan.md`
- `docs/production-env-checklist.md`
- `docs/postgres-ui-smoke.md`
- `docs/production-rollback-strategy.md`
- `docs/day-15-secrets-no-leak-audit.md`
