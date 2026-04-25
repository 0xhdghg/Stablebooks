# Stablebooks Day 20 Repeated Staging Runbook

## Purpose

This runbook captures the lower-touch path for repeating Railway staging
rehearsals after Day 20.

## Prerequisites

Set these environment variables before running the helpers:

- `STABLEBOOKS_API_BASE_URL`
- `STABLEBOOKS_WEB_BASE_URL`
- `ARC_WEBHOOK_SECRET`
- `ARC_CHAIN_ID`
- `ARC_EVENT_CONTRACT_ADDRESS`
- `ARC_EVENT_SIGNATURE`
- `ARC_EVENT_TOKEN_SYMBOL`
- `ARC_EVENT_TOKEN_DECIMALS`

## Bootstrap only

Use this when you want fresh operator/bootstrap values without running payment
smoke yet.

```powershell
corepack pnpm --filter @stablebooks/api bootstrap:hosted-staging
```

Useful variants:

```powershell
corepack pnpm --filter @stablebooks/api bootstrap:hosted-staging -- --dry-run
corepack pnpm --filter @stablebooks/api bootstrap:hosted-staging -- --env
```

## Full hosted rehearsal

Use this to run the whole path:

- operator bootstrap
- organization/wallet/customer setup
- hosted API smoke
- hosted Web smoke

```powershell
corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging
```

## Important Day 20 behavior

The bootstrap helper now generates a unique settlement wallet address by
default when `STAGING_SETTLEMENT_WALLET` is not explicitly provided.

This avoids cross-organization matching collisions during repeated hosted
rehearsals.

## Expected output shape

The full rehearsal helper returns JSON including:

- bootstrap operator email
- organization id
- customer id
- wallet address
- created invoice id
- created public token
- created payment id
- tx hash
- UI route check results

## Current result

Day 20 verified that this helper can successfully run against Railway staging
and produce:

- exact payment match
- finalized payment
- paid invoice
- passing Web route smoke
