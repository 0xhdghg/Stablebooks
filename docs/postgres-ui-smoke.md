# Stablebooks Postgres UI Smoke

## Document status

- Date: `2026-04-22`
- Scope: `Day 15 Slice 4`
- Status: `draft`

## Purpose

This smoke confirms the operator UI is reading a Postgres-backed runtime, not
only the JSON fallback.

It should be run after the production-like flow smoke creates an invoice,
payment, Arc provider observation, finality event, and webhook delivery.

## Preconditions

API runtime:

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

API readiness:

```text
GET /api/v1/health/storage
```

Expected:

- `postgresBackedRuntimeReady=true`
- `jsonStoreActive=false`
- Postgres is configured and reachable
- all `runtimeWriteModes` are `postgres`

Web runtime:

```env
API_BASE_URL=http://127.0.0.1:4000/api/v1
```

For hosted/staging, use the deployed API base URL.

## Start commands

API:

```powershell
corepack pnpm --filter @stablebooks/api build
corepack pnpm --filter @stablebooks/api start
```

Web:

```powershell
corepack pnpm --filter @stablebooks/web build
corepack pnpm --filter @stablebooks/web start
```

Development alternative:

```powershell
corepack pnpm dev
```

## Create smoke data

Run:

```powershell
corepack pnpm --filter @stablebooks/api smoke:production-flow -- --dry-run
corepack pnpm --filter @stablebooks/api smoke:production-flow
```

Capture from script output:

- `invoiceId`
- `paymentId`
- `webhookDeliveryStatus`

## UI routes to check

### Sign in

Open:

```text
/signin
```

Expected:

- operator can sign in with the seeded/staging operator account
- dashboard shell loads

### Invoice detail

Open:

```text
/invoices/<invoiceId>
```

Expected:

- invoice status is `paid`
- latest payment status is `finalized`
- settlement observation table shows:
  - `txHash`
  - `rawChainEventId`
  - `logIndex`
  - `blockNumber`
  - `from`
  - `to`
  - `token`
  - `amount`
  - `chainId`
  - `chainSourceConfirmedAt`
- `Provider source` card shows:
  - boundary `circle_event_monitor`
  - source kind `webhook`
  - profile match: matched expected provider profile
  - no provider warnings, unless intentionally injected
- `Webhook delivery` card shows a `payment.finalized` delivery:
  - `disabled` if no outbound webhook URL is configured
  - `delivered`, `failed`, or `dead_letter` if a URL is configured

### Payment detail

Open:

```text
/payments/<paymentId>
```

Expected:

- payment status is `finalized`
- settlement summary shows exact match
- onchain observation shows the same tx/hash/block/token fields as invoice
  detail
- confirmation fields show:
  - `txHash`
  - `blockNumber`
  - `Token`
  - `Atomic amount`
  - `Chain source confirmed at`
  - `Stablebooks terminal confirmed at`
- `Provider source` card shows:
  - `Circle/Event Monitor verified`
  - boundary `circle_event_monitor`
  - source kind `webhook`
  - profile matched
- latest webhook card shows the delivery created by finality

### Webhook queue

Open:

```text
/webhooks
```

Expected:

- delivery created by the smoke flow is visible
- if outbound URL is empty:
  - delivery status is `disabled`
  - diagnostic explains that no destination is configured
- if outbound URL is configured:
  - delivery status and retry/dead-letter details match API result

### Hosted invoice

Open:

```text
/pay/<publicToken>
```

Expected:

- paid/finalized invoice should route or display a terminal paid/success state
- customer-facing state should not expose operator diagnostics

## Failure signs

Investigate if:

- `/health/storage` does not show `postgresBackedRuntimeReady=true`
- invoice appears in API smoke output but not in UI
- provider source card is missing after Arc provider event
- `sourceProfileMatched` is not represented as matched
- webhook delivery exists in API but is absent from UI
- UI shows old JSON fallback data after smoke

## Notes

- This smoke is intentionally manual for Day 15.
- A browser automation can be added later once the core production-like flow is
  stable.
- Do not paste real secrets into screenshots or docs.
