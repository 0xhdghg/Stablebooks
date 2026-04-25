# Stablebooks Day 12 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Production hardening before Arc provider setup`
- Status: `accepted`

## Acceptance summary

Day 12 is accepted for the current MVP stage.

Stablebooks now has a safer Postgres-backed payment runtime before production
Arc provider setup. The day focused on failure behavior, idempotency, retry
boundaries, replay safety, and operator diagnostics.

The important product result is that payment/webhook operations are now less
fragile under repeated events and downstream delivery failures.

## Accepted capabilities

- Duplicate terminal finality no longer creates duplicate canonical webhook
  deliveries.
- Repeated `finalized` calls return the finalized payment without emitting a
  second canonical `payment.finalized` delivery.
- Repeated `failed` calls return the failed payment without emitting a second
  canonical `payment.failed` delivery.
- Explicit replay remains the intentional way to create another outbound
  webhook delivery.
- Raw chain ingestion idempotency remains intact.
- Observation matching idempotency remains intact.
- Retry preserves delivery payload and increments attempt state.
- Replay creates a linked delivery through `replayOfDeliveryId`.
- Replay preserves:
  - `eventId`
  - `eventCreatedAt`
  - payload
- Replay does not mutate the original delivery.
- A real HTTP `500` webhook endpoint produces persisted failed delivery state.
- Forced retry exhaustion moves delivery to `dead_letter`.
- Operator-facing diagnostics are exposed in API responses and UI.

## Operator diagnostics

Webhook delivery responses now include a `diagnostic` object with:

- `severity`
- `label`
- `detail`
- `nextAction`

The UI renders diagnostics on:

- `/webhooks`
- invoice detail latest webhook card
- payment detail latest webhook card

Covered states:

- delivered
- disabled
- failed with retry scheduled
- dead-letter

## Verified checks

The following checks passed locally:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- `corepack pnpm --filter @stablebooks/web typecheck`
- `corepack pnpm --filter @stablebooks/web build`

## Verified regressions

API regression suite now includes:

- Arc finalized/failed regressions
- Postgres webhook retry/replay regressions

Webhook regression verifies:

- duplicate terminal confirmation does not create duplicate canonical delivery
- retry updates the same delivery
- retry increments `attemptCount`
- retry preserves payload
- replay creates a new delivery
- replay links through `replayOfDeliveryId`
- replay preserves event identity and payload
- replay does not mutate original delivery
- disabled delivery diagnostics remain present

## Verified smoke

Forced failing webhook endpoint smoke verified:

1. local endpoint returns HTTP `500`
2. delivery moves to `failed`
3. response status/body/error are persisted
4. destination and signature are persisted
5. `nextAttemptAt` is populated

Forced dead-letter smoke verified:

1. max attempts set to `2`
2. first failed attempt schedules retry
3. manual retry fails again
4. delivery moves to `dead_letter`
5. `deadLetteredAt` is populated
6. `nextAttemptAt` is cleared
7. dead-letter queue includes the delivery
8. active queue excludes the delivery

Temporary smoke/regression records were cleaned by the scripts.

## Current boundaries

Day 12 does not connect Stablebooks to production Arc infrastructure yet.

Still outside the accepted scope:

- production Arc RPC integration
- production Arc webhook endpoint setup
- removing JSON fallback
- partial payment or overpayment accounting
- merchant webhook endpoint management UI
- deployment setup

## Product meaning

After Day 12, Stablebooks has a Postgres-backed MVP payment runtime that is much
closer to production shape:

1. repeated chain/finality events are safer
2. canonical webhook deliveries do not duplicate on terminal no-op calls
3. webhook failure state is persisted and explainable
4. dead-letter behavior is proven
5. retry/replay behavior is regression-tested
6. operators can see why a delivery is stuck and what to do next

## Next recommended day

Recommended Day 13 theme:

- production Arc provider setup plan
- real Arc RPC/finality ingestion boundary
- environment variable contract for Arc credentials and endpoints
- provider adapter cleanup if the current mock/provider split needs it
