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
