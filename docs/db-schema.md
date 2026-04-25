# Stablebooks DB Schema

## Document status

- Date: `2026-04-20`
- Scope: `Day 2 Postgres schema and invariants`
- Status: `working baseline`

## Goal

Day 2 is complete only when the database foundation does more than store
tables.

The schema should guarantee:

- idempotent payment ingestion
- deterministic matching inputs
- debuggable payment history
- durable webhook delivery state
- clean boundaries between raw chain evidence and business settlement state

## Architectural decisions

### 1. Invoice to payments

Stablebooks should support `one invoice -> many payments`.

This keeps the schema compatible with:

- repeated payment attempts
- duplicate transfers
- recovery from failed attempts
- future partial payment support

For the current product slice, the canonical operator flow still assumes one
clean payment settles one invoice. The schema is more flexible than the current
UI contract on purpose.

Current implementation note:

- `payments.invoice_id` remains required, because the current hosted payment
  flow creates invoice-bound payment attempts first and then enriches them with
  settlement data

### 2. Source of truth layers

Stablebooks should keep chain evidence and business state separate.

- `raw_chain_events`: append-only raw onchain evidence
- `chain_payment_observations`: normalized settlement observations derived from
  raw chain data
- `payments`: operator-facing settlement records after matching and business
  processing
- `payment_events`: business-level state transition log

Raw chain evidence and business payment state should never be collapsed into a
single table.

### 3. Idempotency rule

The canonical ingestion identity should be:

- `unique(chainId, txHash, logIndex)` for EVM event-shaped ingestion

If a source cannot provide `logIndex`, Stablebooks may temporarily fall back to
an observation-level strategy such as `chainId + txHash`, but the storage model
should be designed around the stronger identity.

Current implementation note:

- Prisma stores `logIndex` on normalized observations and raw events with a
  default of `0`, which gives the current system a stable idempotency key even
  for mock or simplified ingestion inputs

### 4. Matching boundary

Matching should be idempotent and replay-safe.

This means:

- replaying ingestion must not create duplicate payment effects
- replaying matching must not change the result for the same normalized input
- payment records should be derived from normalized observations, not directly
  from raw event payloads

### 5. Webhook delivery model

Stablebooks should treat webhook configuration and webhook delivery as separate
concepts.

- `webhook_endpoints`: destination configuration
- `webhook_deliveries`: per-event delivery attempts and retry state

This keeps outbound reliability and operator debugging manageable.

## Day 2 table set

### Core identity and tenancy

- `users`
- `sessions`
- `organizations`
- `memberships`

### Payments domain

- `wallets`
- `customers`
- `invoices`
- `payments`
- `payment_events`
- `raw_chain_events`
- `chain_payment_observations`

### Webhooks

- `webhook_endpoints`
- `webhook_deliveries`

## Table shape guidance

### invoices

Minimum intent:

- commercial receivable record
- hosted public payment entry point
- expected payment configuration for matching

Key fields:

- `id`
- `organization_id`
- `customer_id`
- `public_token`
- `reference_code`
- `expected_amount`
- `expected_token`
- `expected_chain_id`
- `status`
- `expires_at`
- `created_at`
- `updated_at`

Recommended indexes:

- `unique(public_token)`
- `index(organization_id, status)`

### payments

Minimum intent:

- one settlement attempt or recognized payment record associated with an invoice
- operator-facing settlement lifecycle object

Key fields:

- `id`
- `organization_id`
- `invoice_id`
- `public_token`
- `status`
- `chain_id`
- `tx_hash`
- `log_index`
- `from_address`
- `to_address`
- `token`
- `amount_raw`
- `decimals`
- `normalized_amount`
- `detected_at`
- `confirmed_at`
- `confirmation_tx_hash`
- `confirmation_block_number`
- `source_confirmed_at`
- `confirmation_received_at`
- `created_at`
- `updated_at`

Recommended indexes:

- `index(invoice_id)`
- `index(status)`
- `index(to_address)`

Note:

The hard uniqueness guarantee for ingestion should live on raw or normalized
event records first. `payments` may still store chain identity fields for
operator visibility and joins.

### raw_chain_events

Minimum intent:

- append-only chain evidence
- replayable ingestion source
- audit/debug record for matching and confirmation issues

Key fields:

- `id`
- `chain_id`
- `tx_hash`
- `log_index`
- `block_number`
- `block_timestamp`
- `from_address`
- `to_address`
- `token`
- `amount`
- `decimals`
- `source_confirmed_at`
- `raw_payload`
- `observed_at`
- `created_at`

Required indexes:

- `unique(chain_id, tx_hash, log_index)`
- `index(block_number)`

### payment_events

Minimum intent:

- business-level event log
- state transitions and payment audit history

Key fields:

- `id`
- `payment_id`
- `type`
- `payload`
- `created_at`
- `updated_at`

### webhook_endpoints

Minimum intent:

- organization-level webhook destination and signing configuration

Key fields:

- `id`
- `organization_id`
- `url`
- `secret`
- `is_enabled`
- `created_at`
- `updated_at`

### webhook_deliveries

Minimum intent:

- per-event outbound delivery record
- retry and dead-letter state

Key fields:

- `id`
- `endpoint_id`
- `payment_id`
- `event_type`
- `payload`
- `status`
- `event_id`
- `event_created_at`
- `payment_status_snapshot`
- `invoice_status_snapshot`
- `replay_of_delivery_id`
- `response_status`
- `response_body`
- `attempt_count`
- `next_attempt_at`
- `created_at`
- `updated_at`

## Invariants

### 1. Payment uniqueness

One onchain event should produce at most one canonical raw event record and at
most one normalized observation record for the same identity.

The primary storage guarantee is:

- `unique(chain_id, tx_hash, log_index)`

### 2. Payment status monotonicity

Payment status transitions should only move forward.

Forbidden examples:

- `finalized -> processing`
- `failed -> matched`

### 3. Matching idempotency

Running matching multiple times for the same normalized observation should
produce the same result and should not duplicate downstream state.

### 4. Invoice aggregation

Invoice settlement state is derived from accepted payments, not from raw chain
events.

For the current product slice:

- one finalized payment can mark an invoice as paid

Future-compatible direction:

- sum of finalized payments may drive `partial`, `paid`, or `overpaid`

Current implementation note:

- the active invoice status set remains `draft`, `open`, `processing`, and
  `paid`; partial or overpaid invoice semantics are intentionally deferred

### 5. Auditability

All stateful business tables should carry audit timestamps:

- `created_at`
- `updated_at`

Settlement-aware tables may also carry lifecycle timestamps such as:

- `detected_at`
- `confirmed_at`
- `source_confirmed_at`
- `confirmation_received_at`

Day 5 implementation note:

- `source_confirmed_at` means the source chain or Arc provider confirmation
  time.
- `confirmation_received_at` means the time Stablebooks accepted a terminal
  confirmation or failure into its own payment state machine.
- Keeping both timestamps lets operators debug the difference between chain
  finality and Stablebooks processing time.

## Day 2 deliverables

Day 2 is complete when all of the following exist:

1. A Prisma ORM schema reflecting the agreed table set and invariants.
2. A reproducible migration that applies cleanly on an empty Postgres database.
3. A minimal seed path that can create one organization and one invoice.
4. This document kept in sync with the implemented schema.
