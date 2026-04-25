# Stablebooks Day 12 Idempotency Audit

## Document status

- Date: `2026-04-21`
- Scope: `Day 12 Slice 1`
- Status: `completed`

## Summary

The current Postgres-backed runtime has the right MVP safety shape:

- raw chain ingestion dedupes duplicate chain events
- matching is repeatable for the same observation
- terminal payment state is monotonic
- retry/replay have separate operator actions

The main hardening gap is canonical webhook delivery creation. Repeated terminal
calls can currently create another `payment.finalized` or `payment.failed`
delivery because webhook dispatch only sees the returned payment status, not
whether the terminal transition actually changed state.

Slice 2 should fix that boundary.

## Audited boundaries

### Raw chain ingestion

Current behavior:

- primary dedupe checks `(chainId, txHash, logIndex)`
- fallback dedupe checks `(chainId, txHash, toAddress, amountAtomic)`
- existing duplicate returns the previous raw event, observation, and match
- database schema also enforces `@@unique([chainId, txHash, logIndex])`

Assessment:

- good MVP idempotency
- acceptable for Day 12
- later production hardening can catch Prisma unique violations from concurrent
  duplicate inserts and serialize them as dedupe responses

### Observation matching

Current behavior:

- `PaymentMatch.observationId` is unique
- matching updates the existing match when the same observation is processed
  again
- exact match event is deduped by payment, type, and note
- `payment_processing_started` only emits when payment moves from `pending`
  into `processing`

Assessment:

- matching is effectively idempotent for repeated runs
- no immediate Slice 2 fix required

### Terminal payment state

Current behavior:

- `finalizePayment` rejects `failed -> finalized`
- `finalizePayment` treats already-finalized payments as no-op
- `failPayment` rejects `finalized -> failed`
- `failPayment` treats already-failed payments as no-op
- both paths preserve monotonic payment status

Assessment:

- terminal state is monotonic and safe
- however, the no-op signal is not exposed to the service layer

### Canonical webhook delivery creation

Current behavior:

- Postgres terminal paths call `dispatchPostgresWebhookIfEnabled(payment)` after
  terminal repository calls
- that helper dispatches by payment status:
  - `finalized` creates `payment.finalized`
  - `failed` creates `payment.failed`
- `createDeliveryForPayment` always creates a new delivery
- schema has indexes for `eventId` and `replayOfDeliveryId`, but no uniqueness
  guard for the canonical terminal delivery

Assessment:

- this is the main Day 12 gap
- repeated terminal calls can create duplicate canonical deliveries
- explicit replay should remain the only intended way to create a second
  delivery for the same payment/event type

Recommended Slice 2 fix:

- make terminal repository methods expose whether the state changed
- only create canonical webhook delivery when `changed === true`
- keep replay behavior unchanged
- optionally add a repository-level guard that reuses an existing non-replay
  delivery for `(paymentId, eventType)` instead of creating another one

### Retry and replay

Current behavior:

- retry loads an existing delivery and attempts the same payload again
- retry increments persisted attempt state
- replay creates a new delivery linked by `replayOfDeliveryId`
- replay preserves event id and event created timestamp when a previous delivery
  exists

Assessment:

- retry/replay separation is good enough for MVP
- Slice 5 should add regression coverage that replay does not mutate the
  original delivery
- later production hardening can decide whether retrying delivered or
  dead-letter deliveries should be blocked or allowed by operator intent

## Slice 2 target

Slice 2 should focus on one concrete behavior:

> repeated terminal finality must not create duplicate canonical webhook
> deliveries.

Acceptance for Slice 2:

- first `finalized` transition creates one `payment.finalized` delivery
- second `finalized` call returns the finalized payment without creating another
  canonical delivery
- first `failed` transition creates one `payment.failed` delivery
- second `failed` call returns the failed payment without creating another
  canonical delivery
- explicit replay still creates a linked delivery
- JSON fallback remains unchanged
