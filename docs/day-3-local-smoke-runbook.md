# Stablebooks Day 3 Local Smoke Runbook

## Goal

Reproduce the canonical Day 3 settlement flow locally without manual database
edits.

## Prerequisites

- Postgres is running locally on `127.0.0.1:5432`
- `apps/api/.env` contains a working `DATABASE_URL`
- the JSON app store can be reseeded for UI-driven smoke checks

## Baseline setup

1. Apply Prisma migrations:

```powershell
cd G:\bugbounty\Stablebooks\apps\api
.\node_modules\.bin\prisma.cmd migrate deploy --schema prisma\schema.prisma
```

2. Seed the JSON app store:

```powershell
cd G:\bugbounty\Stablebooks\apps\api
node scripts\seed-dev-store.js
```

Seed login:

- `operator@stablebooks.dev`
- `stablebooks123`

## Canonical API smoke

Use the dev chain key:

- `stablebooks-dev-chain-key`

### Step 1. Ingest one raw event

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-mock-chain-key" = "stablebooks-dev-chain-key"
}

$ingest = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/payments/mock/raw-chain-event" `
  -Headers $headers `
  -Body (@{
    txHash = "0xday3manual000000000000000000000000000000000000000000000000000001"
    logIndex = 1
    blockNumber = 14001
    from = "0xffffffffffffffffffffffffffffffffffffffff"
    to = "0x1111111111111111111111111111111111111111"
    token = "USDC"
    amount = "1250000000"
    decimals = 6
    chainId = 777
    rawPayload = @{
      source = "manual-runbook"
    }
  } | ConvertTo-Json -Depth 5)

$ingest.data
```

Expected result:

- `rawEvent` exists
- `observation` exists
- `match.matchResult` is `exact`
- `payment.status` is `processing`

### Step 2. Confirm the matched observation

```powershell
$observationId = $ingest.data.observation.id

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/payments/mock/observations/$observationId/confirm" `
  -Headers $headers `
  -Body (@{
    settlementReference = "arc_settle_manual"
  } | ConvertTo-Json)
```

Expected result:

- payment becomes `finalized`
- invoice becomes `paid`
- observation becomes `confirmed`
- webhook delivery is created

### Step 3. Failed-path alternative

Instead of confirmation, fail the same observation:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/payments/mock/observations/$observationId/fail" `
  -Headers $headers `
  -Body (@{
    failureReason = "Chain event invalidated in settlement pipeline."
  } | ConvertTo-Json)
```

Expected result:

- payment becomes `failed`
- invoice returns to `open`
- observation becomes `rejected`
- webhook delivery is created with event type `payment.failed`

## Operator UI smoke

1. Start the API:

```powershell
cd G:\bugbounty\Stablebooks
corepack pnpm --filter @stablebooks/api start:dev
```

2. Start the web app in another terminal:

```powershell
cd G:\bugbounty\Stablebooks
corepack pnpm --filter @stablebooks/web dev
```

3. Sign in at:

- `http://127.0.0.1:3000/signin`

4. Open these pages after running the API smoke:

- `http://127.0.0.1:3000/invoices/inv_seed_apr_2026`
- `http://127.0.0.1:3000/payments/pay_seed_apr_2026`
- `http://127.0.0.1:3000/webhooks`

## What should be visible in the UI

On invoice detail and payment detail:

- `txHash`
- `rawChainEventId`
- `logIndex`
- `blockNumber`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`
- `observedAt`
- `confirmedAt`
- `confirmationSource`

On webhook operations:

- new delivery record
- event type
- payment and invoice snapshots
- disabled or retry state depending on webhook configuration
