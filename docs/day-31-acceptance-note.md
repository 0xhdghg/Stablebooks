# Stablebooks Day 31 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 31 added a minimal Arc native log forwarder for the existing `rpc_polling`
Arc source mode.

The hosted API can now poll Arc Testnet RPC for native Arc USDC transfer logs
from `0x1800000000000000000000000000000000000000`, decode the low-level log
topics/data, and submit matched events into the existing ingestion, matching,
finality, and webhook dispatch pipeline.

## Verification

Local API checks passed:

```text
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
```

Hosted Railway API was deployed with:

```text
Deploy Day 31 Arc native log forwarder
Deploy Day 31 Arc native log forwarder guard
```

Hosted readiness reports:

```text
sourceKind: rpc_polling
ready: true
chainId: 5042002
hasRpcUrl: true
contractAddress: 0x1800000000000000000000000000000000000000
eventSignature: ArcNativeUSDCTransfer(address,address,uint256)
tokenSymbol: USDC
tokenDecimals: 18
```

The forwarder starts from a future `ARC_START_BLOCK` to avoid historical replay.
Unrelated native USDC transfers to non-Stablebooks wallets are skipped and do
not stop the polling cursor.
