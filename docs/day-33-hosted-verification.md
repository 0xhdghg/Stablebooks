# Stablebooks Day 33 Hosted Verification

## Runtime

- API: `https://stablebooks-api-production.up.railway.app`
- Web: `https://stablebooks-web-production.up.railway.app`
- Environment: Railway `production`
- Date: `2026-04-29`

## Slice 2 Deployment

The API was deployed to Railway with:

```text
Deploy Day 33 polling checkpoint hardening
```

## Health

Hosted API liveness after deploy:

```text
GET /api/v1/health/live -> ok
```

Arc source state:

```text
sourceKind -> rpc_polling
startBlock -> 39643000
```

## Checkpoint Verification

The latest persisted real Arc event before deploy was:

```text
txHash -> 0x18a7097ad767fa7b54a0b75448e1a1a3b547ca6bb18edb42259ed8f892017f20
blockNumber -> 39643642
logIndex -> 17
chainId -> 5042002
```

After deploy, Railway logs showed:

```text
Arc native log poller resumed from persisted checkpoint block 39643643.
```

This confirms the poller used the persisted `RawChainEvent` checkpoint instead
of restarting from the older configured `ARC_START_BLOCK`.

## Existing Real Payment State

The real Arc invoice from Slice 1 remained settled:

```text
invoice -> SB-CFBAFF
invoiceStatus -> paid
paymentStatus -> finalized
matchResult -> exact
public redirectHint -> success
```

## Result

Day 33 Slice 2 is accepted for hosted runtime: the API can resume the Arc RPC
poller from the latest persisted real Arc event after redeploy.

## Slice 3 Deployment

The Web app was deployed to Railway with:

```text
Deploy Day 33 public payment route guards
```

## Public Payment Route Guard Verification

Verification used the real paid invoice public token:

```text
publicToken -> pub_fd89510e735219d4ea0f1b21
invoice -> SB-CFBAFF
invoiceStatus -> paid
paymentStatus -> finalized
```

Hosted route results:

```text
GET /pay/pub_fd89510e735219d4ea0f1b21/issue -> 307 /success
GET /pay/pub_fd89510e735219d4ea0f1b21/processing -> 307 /success
GET /pay/pub_fd89510e735219d4ea0f1b21/success -> 200 receipt
GET /pay/invalid-public-token/processing -> 200 Payment issue screen
```

This confirms stale issue/processing URLs no longer strand a finalized payment
on an error-like state, and invalid processing URLs no longer surface the raw
Next.js 404 page.

## Slice 4 Clean Real E2E Rehearsal

Verification used a fresh hosted invoice and a real Arc Testnet native USDC
payment from MetaMask.

```text
invoice -> SB-9992D5
invoiceId -> inv_515997428d6b1fc2
publicToken -> pub_269819910985f3566aa65b4f
paymentId -> pay_5630eedf657868b3
paymentPublicToken -> pay_pub_1df25f1d5509b36d
amount -> 0.31 USDC
settlementWallet -> 0x1111111111111111111111111111111111111111
```

The first MetaMask transaction attempt stayed pending and was cancelled before
settlement. The clean replacement transaction was:

```text
txHash -> 0x2a73231db61a31fa59e157253bf5584e899ba1bb4a1ad8e4e9e2c8b27ba63d49
blockNumber -> 39691767
logIndex -> 26
from -> 0x69a5a79242eb4ac6a4de45779090d54ecae721d0
to -> 0x1111111111111111111111111111111111111111
amountAtomic -> 310000000000000000
amountNormalized -> 0.31 USDC
```

Hosted API state after RPC polling:

```text
invoiceStatus -> paid
paymentStatus -> finalized
matchResult -> exact
amountPaidMinor -> 31
finalSettlement -> true
redirectHint -> success
settlementReference -> arc-rpc-2a73231d-26
confirmationSource -> arc_ingestion
sourceConfirmedAt -> 2026-04-29T20:02:24.000Z
confirmedAt -> 2026-04-29T20:02:39.901Z
finalizedAt -> 2026-04-29T20:02:39.901Z
```

The public success URL rendered the completed receipt:

```text
GET /pay/pub_269819910985f3566aa65b4f/success -> success receipt
```

Outbound merchant webhook delivery was created as `disabled` because no
merchant `STABLEBOOKS_WEBHOOK_URL` is configured in this hosted testnet
runtime. This is an expected non-blocker for the current public testnet
rehearsal.

## Slice 4 Result

Day 33 Slice 4 is accepted: a fresh real Arc Testnet payment completed the
hosted invoice flow through automatic RPC polling, exact matching,
finalization, and stable public success routing without manual backend
match/confirm recovery.
