# Stablebooks Day 4 Provider Assumptions

## Document status

- Date: `2026-04-20`
- Scope: `Slice 1 / provider assumptions`
- Status: `decided`

## Goal

Capture the assumptions Stablebooks will use before picking a concrete Arc
provider implementation, so Slice 2 can focus on building the adapter instead
of reopening architecture decisions.

## Stable assumptions for Slice 2

- Stablebooks will integrate through one Arc adapter boundary in `apps/api`
- the adapter may read from RPC, indexer, or provider-specific webhook input
- downstream services must not depend on provider-specific payload shape
- the adapter must emit the canonical Day 4 Arc event contract
- the first useful path is inbound transfer detection to known settlement wallets
- the product does not require a custom smart contract for MVP
- the first production path can be polling-based
- local development may use replayable fixture payloads through the same adapter
- idempotency must be enforced before matching starts
- raw provider payloads should be retained for auditability and debugging

## Default implementation assumptions

Until proven otherwise, Stablebooks will assume:

- one primary Arc network per environment
- one configured `chainId` per environment
- known settlement wallets are stored in the existing wallet model
- the token list is small and explicitly allowlisted
- transfer observations arrive after enough confirmation to populate
  `confirmedAt`
- the adapter can derive `txHash`, `blockNumber`, `from`, `to`, `token`,
  `amount`, `decimals`, and `chainId` from the source payload

## Constraints for the first adapter

- no provider-specific logic should leak into matching or UI code
- no multi-chain abstraction layer should be introduced yet
- no background reconciliation system is required for Slice 2
- no historical backfill is required for the first implementation
- no partial payment aggregation logic is required at ingestion time

## Open questions intentionally deferred

These are real questions, but they should not block Slice 2 scaffolding:

- which exact Arc provider will be used first
- whether the first live source is polling, webhook, or event stream
- what the final confirmation threshold should be
- how often polling should run in production
- whether token identity is best represented by symbol, address, or both on Arc
- whether local development should replay JSON fixtures or poll a dev Arc source
- how much provider metadata should be preserved in `rawPayload`

## What must be answered before Slice 3 or Slice 4

- the concrete provider or source type
- the exact adapter input shape
- the confirmation policy that sets `confirmedAt`
- the environment variables needed for provider credentials and network config

## Decision outcome

Slice 1 is considered complete when these are true:

- the source strategy is frozen
- the canonical inbound contract is frozen
- provider assumptions are written down
- remaining unknowns are isolated well enough to start adapter implementation
