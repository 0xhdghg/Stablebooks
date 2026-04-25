# Stablebooks Day 4 Arc Dev Runbook

## Goal

Exercise the new Arc adapter path without using `payments/mock/*`.

This runbook is only for local development. It uses the dev-only Arc routes
that sit in front of `ArcAdapterService`.

## Routes

- `GET /api/v1/arc/dev/readiness`
- `GET /api/v1/arc/dev/state`
- `GET /api/v1/arc/dev/evidence-store`
- `GET /api/v1/arc/dev/fixtures`
- `POST /api/v1/arc/dev/fixtures/:fixtureName/ingest`
- `POST /api/v1/arc/dev/ingest`
- `POST /api/v1/arc/webhooks/events`
- `POST /api/v1/arc/webhooks/finality`

## Auth

Use the dev header:

- `x-arc-dev-key: stablebooks-dev-arc-key`

If needed, override it through:

- `ARC_DEV_INGEST_KEY`

## Baseline setup

1. Seed the JSON store:

```powershell
cd G:\bugbounty\Stablebooks\apps\api
node scripts\seed-dev-store.js
```

2. Start the API:

```powershell
cd G:\bugbounty\Stablebooks
corepack pnpm --filter @stablebooks/api start:dev
```

Optional Day 5 evidence mirror mode:

```powershell
$env:STABLEBOOKS_ARC_EVIDENCE_MIRROR = "postgres_shadow"
```

When this flag is set, Arc ingestion still uses the current JSON-backed payment
pipeline, but raw chain evidence and normalized observations are also mirrored
into Postgres through the Prisma repository layer.

Use `postgres_shadow` while verifying the migration path. Reserve
`postgres_strict` for later, when the payment runtime is ready to fail closed on
database write errors.

## Step 1. Check Arc adapter readiness

```powershell
curl.exe -s http://127.0.0.1:4000/api/v1/arc/dev/readiness `
  -H "x-arc-dev-key: stablebooks-dev-arc-key"
```

Expected result:

- `data.ready` is `true` for the current config surface
- `data.sourceKind` returns the configured Arc source kind
- `data.missing` lists any missing config if the adapter is not ready

## Step 1.5. Check Arc adapter state summary

```powershell
curl.exe -s http://127.0.0.1:4000/api/v1/arc/dev/state `
  -H "x-arc-dev-key: stablebooks-dev-arc-key"
```

Expected result:

- `enabled`, `sourceKind`, and `chainId` are visible in one response
- `hasRpcUrl` and `hasWebhookSecret` show whether source credentials are present
- `pollIntervalMs` and `confirmationsRequired` expose current runtime settings
- `fixtureCount` and `fixtures` show what can be replayed locally

## Step 1.6. Check Postgres evidence repository summary

```powershell
curl.exe -s http://127.0.0.1:4000/api/v1/arc/dev/evidence-store `
  -H "x-arc-dev-key: stablebooks-dev-arc-key"
```

Expected result:

- `data.backend` is `postgres`
- `data.summary.rawEventCount` is returned from Postgres
- `data.summary.observationCount` is returned from Postgres
- latest raw event and observation are shown when database evidence exists

If `STABLEBOOKS_ARC_EVIDENCE_MIRROR=postgres_shadow` is enabled, Arc ingestion
responses should include `postgresMirror` metadata showing whether the evidence
write was `created`, `deduped`, `skipped`, or `failed`.

## Day 5 regression command

Run the Arc finalized and failed regression suite with:

```powershell
cd G:\bugbounty\Stablebooks
corepack pnpm --filter @stablebooks/api test
```

The regression runner:

- builds the API
- starts it on an isolated test port
- enables `postgres_shadow` evidence mirroring
- creates temporary invoices and payment sessions
- verifies Arc finalized and failed paths
- restores the JSON store after the run
- removes temporary Postgres evidence rows after the run

## Day 6 Postgres seed parity

Refresh the Postgres seed data with:

```powershell
cd G:\bugbounty\Stablebooks
corepack pnpm --filter @stablebooks/api db:seed
```

The seed creates a UI-readable Postgres workspace:

- operator user and compatible smoke sessions
- organization and admin membership
- Arc collection wallet
- customer
- open invoice with Arc expected fields
- pending payment
- payment session event
- disabled webhook endpoint

Use this before running API/UI smoke with:

```powershell
$env:STABLEBOOKS_STORAGE_MODE = "postgres_reads"
```

## Step 2. Post one provider-style Arc payload

```powershell
$payload = @{
  txHash = "0xarcdev000000000000000000000000000000000000000000000000000000000001"
  blockNumber = 202001
  confirmedAt = "2026-04-20T17:25:00.000Z"
  from = "0x3333333333333333333333333333333333333333"
  to = "0x1111111111111111111111111111111111111111"
  token = "USDC"
  amount = "1250000000"
  decimals = 6
  chainId = 777
  logIndex = 0
  blockTimestamp = "2026-04-20T17:24:55.000Z"
  provider = "arc-dev-fixture"
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/arc/dev/ingest" `
  -Headers @{ "x-arc-dev-key" = "stablebooks-dev-arc-key" } `
  -ContentType "application/json" `
  -Body $payload
```

Expected result:

- provider payload is normalized into `canonicalEvent`
- `rawEvent` is created
- `observation` is created
- `paymentMatch.matchResult` becomes `exact`
- seeded payment moves to `processing`

## Step 3. Use a named fixture

List available fixtures:

```powershell
curl.exe -s http://127.0.0.1:4000/api/v1/arc/dev/fixtures `
  -H "x-arc-dev-key: stablebooks-dev-arc-key"
```

Replay the canonical exact-match fixture:

```powershell
$payload = @{
  txHash = "0xarcfixtureoverride000000000000000000000000000000000000000000000000000001"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/arc/dev/fixtures/invoice_exact_match/ingest" `
  -Headers @{ "x-arc-dev-key" = "stablebooks-dev-arc-key" } `
  -ContentType "application/json" `
  -Body $payload
```

Expected result:

- one named fixture is expanded into a canonical Arc event
- optional overrides are applied on top of the fixture
- the event enters the same Arc adapter path as a raw provider payload
- `canonicalEvent.confirmedAt` is preserved as normalized `sourceConfirmedAt`
  on the created observation and matched payment
- the seeded payment reaches `processing`

## Step 4. Confirm the matched observation

```powershell
$ingest = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/arc/dev/fixtures/invoice_exact_match/ingest" `
  -Headers @{ "x-arc-dev-key" = "stablebooks-dev-arc-key" } `
  -ContentType "application/json" `
  -Body "{}"

$observationId = $ingest.data.observation.id

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/payments/mock/observations/$observationId/confirm" `
  -Headers @{ "x-mock-chain-key" = "stablebooks-dev-chain-key" } `
  -ContentType "application/json" `
  -Body (@{
    settlementReference = "arc-final-001"
  } | ConvertTo-Json)
```

Expected result:

- payment becomes `finalized`
- `sourceConfirmedAt` remains the chain-level confirmation time from Arc input
- `confirmedAt` and `confirmationReceivedAt` represent Stablebooks terminal
  processing time
- `confirmationSource` is `arc_ingestion`

## What this verifies

This proves the new Arc path already does:

- provider payload intake
- fixture-based provider replay
- normalization into the Day 4 canonical event contract
- internal handoff through `ArcAdapterService`
- persistence into the raw evidence layer
- matching through the existing Day 3 payment flow

## What this does not verify yet

- real provider polling
- real provider webhooks
- automatic Arc confirmation/finality handling
- non-mock webhook emission from the Arc path
- operator UI smoke through the new path

Those belong to later Day 4 steps.

## Production-shaped webhook ingress

There is now one non-dev Arc ingress route:

- `POST /api/v1/arc/webhooks/events`
- `POST /api/v1/arc/webhooks/finality`

Use the header:

- `x-arc-webhook-secret: <ARC_WEBHOOK_SECRET>`

Expected runtime config for this route:

- `ARC_SOURCE_ENABLED=true`
- `ARC_SOURCE_KIND=webhook`
- `ARC_WEBHOOK_SECRET` set

This route uses the same provider payload normalizer as the dev ingress path,
but it rejects requests when the Arc source is disabled, when source mode is
not `webhook`, or when the webhook secret does not match.

## Production-shaped finality webhook

`POST /api/v1/arc/webhooks/finality` accepts a finality payload with:

- `chainId`
- `txHash`
- optional `logIndex`
- `outcome` resolving to `finalized` or `failed`
- optional `confirmedAt`
- optional `blockNumber`

This route:

- finds the existing normalized observation by onchain locator
- refreshes `sourceConfirmedAt` and `blockNumber` when supplied
- drives the existing `arc_ingestion` terminal transition path
- emits the same webhook side effects as the current Day 3/4 payment backend

### Finalized example

```powershell
$payload = @{
  chainId = 777
  txHash = "0xarcdev000000000000000000000000000000000000000000000000000000000001"
  logIndex = 0
  outcome = "finalized"
  confirmedAt = "2026-04-20T17:30:00.000Z"
  blockNumber = 202006
  settlementReference = "arc-final-001"
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/arc/webhooks/finality" `
  -Headers @{ "x-arc-webhook-secret" = "replace-me" } `
  -ContentType "application/json" `
  -Body $payload
```

Expected result:

- payment becomes `finalized`
- linked invoice becomes `paid`
- observation becomes `confirmed`
- `payment.finalized` webhook delivery is emitted

### Failed example

```powershell
$payload = @{
  chainId = 777
  txHash = "0xarcfailed000000000000000000000000000000000000000000000000000000000001"
  logIndex = 0
  outcome = "failed"
  confirmedAt = "2026-04-21T06:46:00.000Z"
  blockNumber = 303002
  failureReason = "Arc provider marked settlement failed for smoke verification"
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:4000/api/v1/arc/webhooks/finality" `
  -Headers @{ "x-arc-webhook-secret" = "replace-me" } `
  -ContentType "application/json" `
  -Body $payload
```

Expected result:

- payment becomes `failed`
- linked invoice returns to `open`
- observation becomes `rejected`
- `payment.failed` webhook delivery is emitted
