# Stablebooks Day 13 Provider Assumptions

## Document status

- Date: `2026-04-22`
- Scope: `Day 13 Slice 1`
- Status: `completed`

## Sources checked

- Arc docs home: `https://docs.arc.network/`
- Arc network overview: `https://docs.arc.network/arc-chain`
- Connect to Arc: `https://docs.arc.network/arc/references/connect-to-arc`
- Node providers: `https://docs.arc.network/arc/tools/node-providers`
- Monitor contract events: `https://docs.arc.network/arc/tutorials/monitor-contract-events`

## Current code boundary

The current Arc module already has the right early shape:

- `ArcConfigService`
- `ArcAdapterService`
- `ArcEventNormalizerService`
- Arc readiness endpoint
- dev ingest endpoint
- webhook event endpoint
- webhook finality endpoint
- fixture ingest path

The current product runtime after Day 12 already supports:

- Postgres raw chain ingestion
- Postgres observation matching
- Postgres terminal finality
- Postgres webhook delivery writes
- retry/replay/dead-letter hardening

So Day 13 should not rewrite the payment runtime. It should define the provider
boundary that feeds canonical Arc evidence into the same runtime.

## Frozen assumptions

### Arc network facts

Assume for the current integration target:

- Arc is EVM-compatible.
- Arc testnet chain id is `5042002`.
- Arc testnet HTTP RPC is `https://rpc.testnet.arc.network`.
- Arc testnet WebSocket endpoint is `wss://rpc.testnet.arc.network`.
- Arc gas token is USDC.
- Arc has deterministic, sub-second finality.
- Arc testnet explorer is `https://testnet.arcscan.app`.

These are sourced from the official Arc docs and should be rechecked before any
production deployment.

### Provider strategy

Recommended first real-provider strategy:

- webhook-first ingestion through Circle/Arc contract event monitoring

Reason:

- the official Arc docs describe event monitor webhooks for contract events
- event monitor webhooks provide real-time push delivery
- polling remains available for retrieving past event logs
- webhook-first matches our current `POST /api/v1/arc/webhooks/events` shape
- it avoids building an always-on indexer before the product needs one

RPC polling remains valid later, but it should stay behind a separate adapter
and checkpoint strategy.

### Required provider event fields

Stablebooks needs a canonical event with:

- `txHash`
- `blockNumber`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`
- `confirmedAt`
- `logIndex`
- `rawPayload`

Mapping from Circle event monitor webhook payload:

- `notification.txHash` -> `txHash`
- `notification.blockHeight` -> `blockNumber`
- `notification.firstConfirmDate` -> `confirmedAt`
- `notification.topics` -> indexed event fields such as `from` and `to`
- `notification.data` -> non-indexed event fields such as amount
- `notification.contractAddress` -> token contract or monitored contract
- `notification.blockchain` -> expected to be `ARC-TESTNET`
- event monitor response/event logs may include `logIndex`

## Current mismatch to resolve later

The current normalizer accepts friendly fields like:

- `from`
- `to`
- `amount`
- `token`
- `decimals`

But real Circle event monitor webhooks can arrive as lower-level event log
payloads:

- topics
- data
- event signature
- contract address
- blockchain name

Therefore a provider-specific decoder is needed before calling the existing
canonical normalizer, or the normalizer needs a dedicated Circle event monitor
branch.

Do not push raw Circle event logs directly into payment matching without
decoding indexed topics and amount data first.

## Finality assumption

Because Arc has deterministic sub-second finality, Stablebooks can treat an Arc
confirmed event as strong evidence after provider verification.

However, the product should still keep separate concepts:

- raw provider event detected
- payment matched
- payment finalized or failed

Reason:

- business-level finalization can still fail for product reasons
- webhook delivery can fail independently
- keeping terminal state explicit makes audits easier

## What remains unknown

These must be verified before production:

- exact production mainnet chain id and RPC endpoints when mainnet/beta is
  available
- final contract addresses for the token/event sources Stablebooks will monitor
- exact Circle webhook authentication/signature mechanism for event monitor
  callbacks in the chosen environment
- whether Circle event monitor callbacks include decoded event args for the
  exact event type we subscribe to, or whether Stablebooks must decode topics
  and data itself
- whether finality should be a separate provider callback or inferred from the
  event monitor confirmation timestamp

## Slice 2 input

Day 13 Slice 2 should document the production Arc env contract with this shape:

- `ARC_SOURCE_ENABLED`
- `ARC_SOURCE_KIND`
- `ARC_CHAIN_ID`
- `ARC_WEBHOOK_SECRET`
- `ARC_EVENT_MONITOR_SOURCE`
- `ARC_EVENT_CONTRACT_ADDRESS`
- `ARC_EVENT_SIGNATURE`
- `ARC_RPC_URL`
- `ARC_START_BLOCK`
- `ARC_POLL_INTERVAL_MS`
- `ARC_CONFIRMATIONS_REQUIRED`

Secrets must never be committed.

## Decision

Proceed with webhook-first provider setup as the recommended Day 13 path.

Keep RPC/indexer polling as a future adapter mode until webhook ingestion is
proven with provider-shaped payload regressions.
