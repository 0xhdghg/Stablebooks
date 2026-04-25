# Stablebooks Arc Polling Checkpoint Strategy

## Document status

- Date: `2026-04-22`
- Scope: `Day 13 Slice 6`
- Status: `design only`

## Why this exists

Stablebooks should start production-like Arc ingestion with webhook-first mode.

RPC or indexer polling can come later, but it must not be bolted directly into
payments. Polling needs a durable cursor so the worker can restart safely,
avoid duplicate ingestion, and explain what block range was processed.

## Current decision

Do not add polling implementation or migration during Day 13.

Reason:

- webhook-first is the chosen near-term provider mode
- raw chain event idempotency already protects ingested events
- adding a cursor table before the polling worker exists would create unused
  schema surface

When polling starts, add one small Postgres table:

```text
provider_checkpoints
```

## Proposed table

Fields:

- `id`
- `provider`
- `source_kind`
- `chain_id`
- `contract_address`
- `event_signature`
- `last_processed_block`
- `safe_block`
- `cursor_payload`
- `status`
- `last_error`
- `created_at`
- `updated_at`

Recommended uniqueness:

```text
unique(provider, source_kind, chain_id, contract_address, event_signature)
```

Recommended indexes:

- `index(chain_id, source_kind)`
- `index(status, updated_at)`

## Cursor identity

The cursor should be scoped to a single monitored stream:

- provider, for example `circle` or `arc_rpc`
- source kind, for example `rpc_polling` or `indexer_polling`
- chain id
- monitored contract address
- event signature

This prevents one token/event stream from advancing another stream's cursor.

## Processing algorithm

For each poll tick:

1. Read the checkpoint row for the monitored stream.
2. Determine `fromBlock`:
   - if checkpoint exists, use `last_processed_block + 1`
   - otherwise use `ARC_START_BLOCK`
3. Determine `safeBlock`:
   - latest provider block minus `ARC_CONFIRMATIONS_REQUIRED`
4. If `safeBlock < fromBlock`, do nothing.
5. Fetch events from `fromBlock` to `safeBlock`.
6. Decode each provider event into canonical Arc event shape.
7. Ingest each canonical event through existing raw evidence ingestion.
8. Advance `last_processed_block` only after the full range succeeds.
9. Store diagnostic metadata in `cursor_payload`.

## Idempotency rule

The cursor is not the primary duplicate protection.

The primary duplicate protection remains:

```text
unique(chain_id, tx_hash, log_index)
```

This means a polling worker can safely replay a range after restart. Duplicate
events should dedupe at raw evidence ingestion, not corrupt payment state.

## Arc confirmation window

Arc has deterministic sub-second finality, so the initial Arc testnet setting
can be:

```env
ARC_CONFIRMATIONS_REQUIRED=1
```

Still keep the confirmation setting because:

- provider APIs can lag behind chain finality
- future networks or providers may need a larger safety window
- it keeps polling behavior configurable without code changes

## Reorg and rollback stance

Arc-specific assumption:

- normal EVM-style reorg handling should not be a major product concern for Arc
  because Arc finality is deterministic

Generic polling stance:

- never delete raw evidence automatically
- if a provider reports a removed/reverted event in a future integration, record
  a compensating payment event instead of mutating history silently
- terminal payment status must remain monotonic unless an explicit operator or
  reconciliation workflow is added

## Failure handling

If a poll range fails:

- do not advance `last_processed_block`
- store `last_error`
- keep status as `degraded`
- retry the same range on the next tick

If one event in the range fails decoding:

- do not ingest the invalid event
- do not advance the cursor unless the worker explicitly supports per-event
  dead-lettering
- prefer failing the whole range first; add event-level dead-lettering later if
  provider noise becomes common

## Status values

Recommended checkpoint status values:

- `active`
- `paused`
- `degraded`

Do not overload payment statuses for provider worker health.

## Observability

The future operator/debug endpoint should show:

- provider
- source kind
- chain id
- contract address
- event signature
- last processed block
- safe block
- last run time
- last error
- status

Do not expose secrets or full provider URLs.

## Day 13 conclusion

Polling modes now have a safe design path, but implementation remains deferred.

The next code step should still be webhook-first provider hardening, not an
always-on polling worker.
