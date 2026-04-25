# Stablebooks Day 16 Rehearsal Results

## Document status

- Date: `2026-04-23`
- Scope: `Day 16 Slice 7`
- Status: `completed`

## Purpose

This note captures the local production-runtime rehearsal results.

The rehearsal proved that Stablebooks can run the canonical production-like
flow through Postgres-backed API paths and expose the resulting payment evidence
in the operator UI.

## Runtime

Local services during result capture:

- API: `http://127.0.0.1:4000/api/v1`
- API process id: `9072`
- Web: `http://127.0.0.1:3000`
- Web process id: `11332`
- Web `API_BASE_URL`: `http://127.0.0.1:4000/api/v1`

Storage posture:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

Provider posture:

- `ARC_SOURCE_ENABLED=true`
- `ARC_SOURCE_KIND=webhook`
- `ARC_CHAIN_ID=5042002`
- `ARC_EVENT_MONITOR_SOURCE=circle_contracts_api`
- `ARC_EVENT_CONTRACT_ADDRESS=0x6666666666666666666666666666666666666666`
- `ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)`
- `ARC_EVENT_TOKEN_SYMBOL=USDC`
- `ARC_EVENT_TOKEN_DECIMALS=6`

Outbound merchant webhook posture:

- `STABLEBOOKS_WEBHOOK_URL=""`
- Expected delivery result: `disabled`

## Preflight

Postgres workspace:

- Prisma connected to local `stablebooks` database.
- `prisma migrate deploy` reported no pending migrations.
- `db:seed` completed successfully.
- Seed prerequisites existed:
  - smoke operator token
  - customer `cus_seed_acme`
  - default collection wallet
    `0x1111111111111111111111111111111111111111`

API readiness:

- `/api/v1/health/live` returned `ok`.
- `/api/v1/health/storage` returned:
  - `postgresBackedRuntimeReady=true`
  - `jsonStoreActive=false`
  - Postgres configured and reachable
  - all runtime write modes set to `postgres`

Arc readiness:

- webhook source kind was ready
- provider source profile was configured
- readiness exposed `hasWebhookSecret=true`
- readiness did not expose raw webhook secret

## Smoke command

The production flow smoke was run without `--dry-run`:

```text
corepack pnpm --filter @stablebooks/api smoke:production-flow
```

## Smoke result

Final smoke output:

```text
ok=true
invoiceId=inv_c858e770c99e6168
publicToken=pub_75edadec50cf2150c7f5f6a3
invoiceStatus=paid
paymentId=pay_9ef0719acf0facca
paymentStatus=finalized
matchResult=exact
providerDiagnostic.sourceProfileMatched=true
webhookDeliveryStatus=disabled
```

Onchain/provider fields verified through API detail reads:

- `txHash=0x3fce23e8f8ad50a20b4361c46a94e0f88138b68dd5a1c4f6ecdf6a5e60beb2d5`
- `chainId=5042002`
- `blockNumber=1776884239`
- `from=0x6666666666666666666666666666666666666666`
- `to=0x1111111111111111111111111111111111111111`
- `token=USDC`
- `amountAtomic=100000000`
- `decimals=6`
- `sourceConfirmedAt=2026-04-22T18:57:19.593Z`

Webhook delivery result:

- event type: `payment.finalized`
- status: `disabled`
- reason: `No STABLEBOOKS_WEBHOOK_URL configured.`
- diagnostic label: `No destination configured`

## UI QA Result

Invoice detail:

- Route: `/invoices/inv_c858e770c99e6168`
- Result: `200`
- Shows paid invoice state.
- Shows finalized latest payment state.
- Shows provider source card.
- Shows smoke tx hash.
- Shows webhook delivery state.

Payment detail:

- Route: `/payments/pay_9ef0719acf0facca`
- Result: `200`
- Shows finalized payment state.
- Shows provider source / Circle Event Monitor details.
- Shows source confirmation fields.
- Shows smoke tx hash.
- Shows webhook delivery state.

Webhook queue:

- Route: `/webhooks?queue=all`
- Result: `200`
- Shows `payment.finalized`.
- Shows `disabled`.
- Shows `No destination configured`.
- Links to the smoke payment.

Hosted payment page:

- Route: `/pay/pub_75edadec50cf2150c7f5f6a3`
- Result: `200`
- Shows paid / `Payment complete`.
- Does not show `Simulate stablecoin payment`.
- Does not expose operator diagnostics.

## Issues Found And Fixed

### Payment detail read path

Issue:

- First non-dry-run smoke created and finalized a Postgres payment.
- `GET /payments/<paymentId>` returned `404`.

Root cause:

- `PaymentsService.getById` and `PaymentsService.listByInvoiceId` still read
  from JSON storage even when `STABLEBOOKS_STORAGE_MODE=postgres_reads`.

Fix:

- Payment detail/list service methods now route to Postgres read repository
  methods when `STABLEBOOKS_STORAGE_MODE=postgres_reads`.

Verification:

- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- repeated non-dry-run smoke passed

### Hosted paid invoice action

Issue:

- Hosted paid invoice still rendered `Simulate stablecoin payment`.

Root cause:

- `/pay/[publicToken]` did not render a terminal customer-facing state for
  already-paid/finalized invoices.

Fix:

- Hosted invoice page now renders `Payment complete` and hides the repeat
  payment action when invoice/payment is settled.

Verification:

- `corepack pnpm --filter @stablebooks/web typecheck`
- `corepack pnpm --filter @stablebooks/web build`
- hosted route QA confirmed the repeat action is hidden

## Acceptance

Day 16 rehearsal result is accepted for local production-runtime rehearsal:

- Postgres-backed runtime reached readiness.
- Non-dry-run smoke completed successfully.
- Payment moved from session creation through provider match to finalized.
- Invoice moved to paid.
- Webhook delivery was created.
- Operator UI displayed invoice, payment, provider diagnostics, tx evidence,
  and webhook queue state.
- Hosted customer page displayed terminal paid state without operator
  diagnostics.

## Remaining Before Hosted Staging

Before hosted staging or production provider registration:

- configure real deployment secret storage
- configure hosted Postgres
- configure real provider webhook endpoint/secret
- decide whether outbound merchant webhook URL should stay disabled or point to
  a staging receiver
- add browser automation if we want repeatable visual smoke instead of manual
  QA
