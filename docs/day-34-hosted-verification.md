# Stablebooks Day 34 Hosted Verification

## Runtime

- API: `https://stablebooks-api-production.up.railway.app`
- Web: `https://stablebooks-web-production.up.railway.app`
- Environment: Railway `production`
- Date: `2026-04-30`

## Slice 1 Pre-Launch Hosted Smoke

The pre-launch smoke verified the hosted runtime before preparing the public
Arc Testnet announcement.

## API Health

```text
GET /api/v1/health/live -> 200 ok
GET /api/v1/health/storage -> 200 ok
GET /api/v1/health/runtime -> 200 ok
```

Runtime highlights:

```text
storageMode -> postgres_reads
postgresBackedRuntimeReady -> true
hostedRuntimePolicy.policyOk -> true
jsonStoreActive -> false
arc.ready -> true
arc.sourceKind -> rpc_polling
arc.chainId -> 5042002
arc.confirmationsRequired -> 1
arc.startBlock -> 39643000
outboundWebhook.mode -> disabled
```

Note: the hosted API does not expose `/api/v1/health/ready`; readiness is
represented by `/api/v1/health/storage` and `/api/v1/health/runtime`.

## Web Availability

```text
GET https://stablebooks-web-production.up.railway.app -> 200
containsStablebooks -> true
```

## Latest Real Arc E2E State

The latest clean real Arc E2E invoice remains finalized:

```text
invoice -> SB-9992D5
invoiceId -> inv_515997428d6b1fc2
publicToken -> pub_269819910985f3566aa65b4f
paymentId -> pay_5630eedf657868b3
invoiceStatus -> paid
paymentStatus -> finalized
amountPaidMinor -> 31
finalSettlement -> true
redirectHint -> success
matchResult -> exact
```

Payment evidence remains visible through the operator API:

```text
txHash -> 0x2a73231db61a31fa59e157253bf5584e899ba1bb4a1ad8e4e9e2c8b27ba63d49
blockNumber -> 39691767
sourceConfirmedAt -> 2026-04-29T20:02:24.000Z
confirmationSource -> arc_ingestion
settlementReference -> arc-rpc-2a73231d-26
```

## Slice 1 Result

Day 34 Slice 1 is accepted: hosted API, storage/runtime readiness, Web
availability, and the latest real Arc E2E finalized payment state are all
healthy enough to proceed to public announcement copy preparation.

## Slice 4.5 Custom Domain Verification

Custom domains were connected through Railway and Namecheap DNS:

```text
Web -> https://stablebooks-app.xyz
API -> https://api.stablebooks-app.xyz/api/v1
```

Railway environment variables were updated:

```text
stablebooks-api APP_BASE_URL -> https://stablebooks-app.xyz
stablebooks-api CORS_ALLOWED_ORIGINS -> includes https://stablebooks-app.xyz
stablebooks-web API_BASE_URL -> https://api.stablebooks-app.xyz/api/v1
stablebooks-web NEXT_PUBLIC_API_BASE_URL -> https://api.stablebooks-app.xyz/api/v1
```

Both services redeployed successfully:

```text
stablebooks-api -> Online
stablebooks-web -> Online
```

Custom-domain smoke results:

```text
GET https://api.stablebooks-app.xyz/api/v1/health/live -> 200 ok
GET https://api.stablebooks-app.xyz/api/v1/health/storage -> 200 ok
GET https://api.stablebooks-app.xyz/api/v1/health/runtime -> 200 ok
GET https://stablebooks-app.xyz -> 200 Stablebooks
GET https://stablebooks-app.xyz/signin -> 200 Stablebooks
GET https://stablebooks-app.xyz/pay/pub_269819910985f3566aa65b4f/success -> 200 receipt
```

Browser/API integration smoke:

```text
origin -> https://stablebooks-app.xyz
POST /api/v1/auth/signin -> 201
GET /api/v1/invoices -> 200
CORS allow-origin -> https://stablebooks-app.xyz
```

Latest real Arc E2E public status remains stable through the custom API domain:

```text
invoiceStatus -> paid
paymentStatus -> finalized
amountPaidMinor -> 31
finalSettlement -> true
redirectHint -> success
```

## Slice 4.5 Result

Day 34 Slice 4.5 is accepted: the branded Web/API domains are connected,
Railway env is cut over, hosted services are online, and the public payment
success route works through `stablebooks-app.xyz`.
