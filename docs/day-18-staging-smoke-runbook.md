# Stablebooks Day 18 Staging Smoke Runbook

## Document status

- Date: `2026-04-25`
- Scope: `Day 18 Slice 6`
- Status: `draft`

## Purpose

This runbook defines the smoke sequence for the first hosted staging
deployment.

It reuses the smoke commands that already passed locally, but applies them to
hosted staging URLs and staging bootstrap data.

## Goal

Prove that hosted staging can execute the canonical flow:

```text
API readiness green
-> invoice created
-> hosted payment session created
-> Arc webhook event accepted
-> payment finalized
-> invoice paid
-> webhook delivery record created
-> operator UI reflects the result
```

## Preconditions

Before running staging smoke, all of these must already be true:

- managed Postgres is provisioned
- migrations are applied
- API is deployed with Postgres-backed flags
- Web is deployed with the correct `API_BASE_URL`
- operator account exists
- organization exists
- default settlement wallet exists
- smoke customer exists

If any precondition is missing, fix that first instead of forcing the smoke.

## Smoke order

Run smoke in this exact order:

1. API readiness check
2. API production flow smoke
3. Web production UI smoke
4. optional manual sanity pass

Reason:

- readiness catches wrong runtime config early
- API flow smoke produces the invoice/payment/public token IDs
- Web smoke consumes those IDs

## Step 1: API readiness check

Verify:

```text
GET https://<staging-api-host>/api/v1/health/live
GET https://<staging-api-host>/api/v1/health/storage
```

Expected:

- API responds over HTTPS
- `postgresBackedRuntimeReady=true`
- `jsonStoreActive=false`
- `storageMode=postgres_reads`
- all write modes are `postgres`

Do not continue if readiness is not green.

## Step 2: API production flow smoke

Command:

```powershell
corepack pnpm --filter @stablebooks/api smoke:production-flow
```

Required env:

```env
SMOKE_API_BASE_URL=https://<staging-api-host>/api/v1
SMOKE_OPERATOR_TOKEN=<fresh-staging-operator-token>
SMOKE_CUSTOMER_ID=<staging-smoke-customer-id>
SMOKE_SETTLEMENT_WALLET=<staging-settlement-wallet-address>
ARC_WEBHOOK_SECRET=<staging-arc-webhook-secret>
ARC_CHAIN_ID=5042002
ARC_EVENT_CONTRACT_ADDRESS=<staging-contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
```

Optional env:

```env
SMOKE_AMOUNT_MINOR=10000
SMOKE_CURRENCY=USD
SMOKE_MEMO=Stablebooks staging smoke
SMOKE_INTERNAL_NOTE=Created by staging smoke
SMOKE_DUE_AT=<iso-timestamp>
ARC_SMOKE_TX_HASH=<unique-test-tx-hash>
ARC_SMOKE_BLOCK_NUMBER=<block-number>
ARC_SMOKE_CONFIRMED_AT=<iso-timestamp>
ARC_SMOKE_FROM=<sender-address>
ARC_SMOKE_AMOUNT_ATOMIC=<atomic-token-amount>
```

Expected result:

- exit code `0`
- output JSON with `ok=true`
- output includes:
  - `invoiceId`
  - `paymentId`
  - `invoiceStatus=paid`
  - `paymentStatus=finalized`
  - `matchResult=exact`
  - `webhookDeliveryStatus`

Capture from output:

- `invoiceId`
- `paymentId`
- `publicToken`
  Note: if `publicToken` is not printed by the script yet, capture it from the
  created invoice read path or API response used in the smoke output/logs.
- optional `txHash`

## Step 3: Web production UI smoke

Command:

```powershell
corepack pnpm --filter @stablebooks/web smoke:production-ui
```

Required env:

```env
SMOKE_WEB_BASE_URL=https://<staging-web-host>
SMOKE_OPERATOR_TOKEN=<fresh-staging-operator-token>
SMOKE_INVOICE_ID=<invoice-id-from-api-smoke>
SMOKE_PAYMENT_ID=<payment-id-from-api-smoke>
SMOKE_PUBLIC_TOKEN=<public-token-from-api-smoke>
```

Optional env:

```env
SMOKE_EXPECTED_TX_HASH=<tx-hash-if-you-want-stronger-assertion>
SMOKE_EXPECTED_WEBHOOK_STATUS=disabled
SMOKE_EXPECTED_INVOICE_STATUS=paid
SMOKE_EXPECTED_PAYMENT_STATUS=finalized
```

Expected result:

- exit code `0`
- output JSON with `ok=true`
- all route checks return `200`

Expected verified routes:

- `/signin`
- `/dashboard`
- `/invoices/<invoiceId>`
- `/payments/<paymentId>`
- `/webhooks?queue=all`
- `/pay/<publicToken>`

Expected semantics:

- operator routes show provider evidence and payment state
- hosted pay page shows terminal success state
- hosted pay page does not expose operator diagnostics

## Step 4: optional manual sanity pass

After automated smoke, it is still useful to open:

- `/signin`
- `/invoices/<invoiceId>`
- `/payments/<paymentId>`
- `/webhooks?queue=all`
- `/pay/<publicToken>`

Manual confirmation should focus only on:

- no broken UI shell
- expected paid/finalized evidence is visible
- hosted public page stays clean and customer-safe

## Recommended staging smoke shell

Example PowerShell flow:

```powershell
$env:SMOKE_API_BASE_URL="https://<staging-api-host>/api/v1"
$env:SMOKE_WEB_BASE_URL="https://<staging-web-host>"
$env:SMOKE_OPERATOR_TOKEN="<fresh-token>"
$env:SMOKE_CUSTOMER_ID="<customer-id>"
$env:SMOKE_SETTLEMENT_WALLET="<settlement-wallet>"
$env:ARC_WEBHOOK_SECRET="<arc-webhook-secret>"
$env:ARC_CHAIN_ID="5042002"
$env:ARC_EVENT_CONTRACT_ADDRESS="<contract-address>"
$env:ARC_EVENT_SIGNATURE="Transfer(address,address,uint256)"
$env:ARC_EVENT_TOKEN_SYMBOL="USDC"
$env:ARC_EVENT_TOKEN_DECIMALS="6"

corepack pnpm --filter @stablebooks/api smoke:production-flow

# Then export the produced invoice/payment/public token IDs:
$env:SMOKE_INVOICE_ID="<invoice-id>"
$env:SMOKE_PAYMENT_ID="<payment-id>"
$env:SMOKE_PUBLIC_TOKEN="<public-token>"

corepack pnpm --filter @stablebooks/web smoke:production-ui
```

## Failure handling

If readiness fails:

- stop and fix env/runtime mode first

If API smoke fails:

- do not trust Web smoke
- inspect API readiness, provider config, and bootstrap data

If Web smoke fails but API smoke passed:

- inspect Web `API_BASE_URL`
- inspect operator token usage
- inspect the specific failing route and rendered data

If webhook status differs from expectation:

- confirm whether outbound merchant webhook is intentionally disabled
- if enabled, adjust expected status or investigate delivery behavior

## Evidence to save

For the first hosted staging rollout, save:

- readiness JSON
- API smoke JSON output
- Web smoke JSON output
- invoice id
- payment id
- public token
- tx hash if available

These artifacts should be referenced in the Day 18 acceptance note.

## Acceptance rule

Staging smoke is accepted when:

- readiness is green
- API smoke returns `ok=true`
- Web smoke returns `ok=true`
- operator evidence is visible
- hosted page remains customer-safe

## Output of this slice

Stablebooks now has a dedicated hosted staging smoke runbook.

## Next step

Proceed to Day 18 Slice 7:

- document rollback and failure playbook for the first hosted staging attempt
