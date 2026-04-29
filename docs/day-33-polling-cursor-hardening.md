# Stablebooks Day 33 Polling Cursor Hardening

## Problem

The Arc RPC poller previously initialized its in-memory cursor only from
`ARC_START_BLOCK`.

That was acceptable for a controlled rehearsal, but it created launch risk:
if `ARC_START_BLOCK` was far behind the current Arc Testnet block, fresh
payments could wait until the poller scanned through old ranges.

## Minimal Fix

The poller now initializes from the greater of:

- configured `ARC_START_BLOCK`
- the latest persisted `RawChainEvent.blockNumber + 1` for the current
  `chainId`, token symbol, and token decimals

This keeps the existing env fallback while allowing hosted redeploys to resume
near the latest already-ingested Arc payment.

## Why This Scope

No new table or provider concept was introduced.

Idempotency still relies on the existing unique key:

```text
(chainId, txHash, logIndex)
```

If checkpoint lookup fails, the poller logs a warning and falls back to the
configured `ARC_START_BLOCK`.

## Verification

Local API checks:

```text
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
```

Both checks passed.

## Remaining Launch Note

This is a minimal checkpoint strategy, not a full block cursor table. It is
enough for the current public testnet MVP because the hosted poller can resume
from the latest real persisted Arc event after redeploy.

A future production version should persist every scanned block range, including
empty ranges, if long no-payment periods become common.
