# Stablebooks Day 31 Execution Plan

## Goal

Add a minimal Arc native log forwarder so hosted staging can ingest Arc native
USDC transfer logs even when Circle Event Monitor does not expose subscriptions
for the native Arc system log address.

## Context

Day 29 proved that Stablebooks can decode native Arc USDC logs from:

- address: `0x1800000000000000000000000000000000000000`
- topic0: `0x62f084c00a442dcf51cdbb51beed2839bf42a268da8474b0e98f38edb7db5a22`
- internal signature: `ArcNativeUSDCTransfer(address,address,uint256)`

Day 30 proved that duplicate settlement wallet matching is safe enough for the
hosted test workspace. Circle still does not deliver these native Arc logs from
the Console subscription UI, so Stablebooks needs a narrow RPC polling fallback.

## Scope

- Implement `rpc_polling` for the existing Arc runtime mode.
- Poll `eth_getLogs` for the configured native Arc USDC contract address and
  known native transfer topic.
- Decode `from`, `to`, `amount`, `txHash`, `blockNumber`, `logIndex`, and block
  timestamp into the existing canonical Arc event shape.
- Reuse the existing Arc adapter, raw event ingestion, matching, finality, and
  webhook dispatch paths.
- Preserve webhook mode and Circle verification behavior unchanged.
- Do not add schema, dependencies, frontend UI, or new provider abstractions.

## Runtime Guardrails

- The forwarder only runs when:
  - `ARC_SOURCE_ENABLED=true`
  - `ARC_SOURCE_KIND=rpc_polling`
  - `ARC_RPC_URL` is configured
  - the source profile targets native Arc USDC
- If `ARC_START_BLOCK` is missing, the forwarder starts from the current
  finalized block plus one to avoid accidental historical replay.
- Duplicate processing is allowed because raw chain ingestion remains
  idempotent by chain, tx hash, and log index.

## Acceptance

- API builds and existing regressions pass.
- In webhook mode, behavior is unchanged.
- In `rpc_polling` mode, the API can poll Arc RPC, decode native USDC logs, and
  submit them into the existing matching/finality pipeline.
- Hosted runtime can be deployed with the forwarder code without exposing
  secrets.
