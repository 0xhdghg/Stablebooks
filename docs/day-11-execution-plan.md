# Stablebooks Day 11 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Postgres webhook delivery write-path migration`
- Status: `completed`

## Goal

Day 11 moves outbound webhook delivery persistence toward Prisma/Postgres:

- delivery creation
- first delivery attempt state
- retry attempt state
- replay delivery creation
- dead-letter state
- webhook delivery payment events

The goal is to support the path:

1. invoice exists in Postgres
2. hosted payment session exists in Postgres
3. raw chain event is ingested into Postgres
4. observation is matched to payment/invoice
5. payment reaches `processing`
6. payment moves to `finalized` or `failed`
7. webhook delivery is created in Postgres
8. delivery attempt updates status in Postgres
9. retry/replay can operate on Postgres deliveries
10. operator sees deliveries and dead-letter queue through the existing UI/API

Day 11 intentionally keeps production Arc provider setup out of scope.

## Day 11 scope

Day 11 includes:

- Prisma write support for webhook delivery creation
- Prisma write support for delivery attempt updates
- Prisma write support for retry attempt updates
- Prisma write support for replay delivery creation
- Prisma write support for dead-letter state
- Prisma write support for webhook delivery timeline events:
  - `webhook_delivery_succeeded`
  - `webhook_delivery_failed`
- Postgres read support for webhook delivery list and queue counters
- preserving existing webhook payload shape
- preserving existing signature behavior
- preserving existing retry/backoff behavior
- preserving JSON fallback
- preserving Arc finalized/failed regressions

Day 11 does not include:

- production Arc provider setup
- removing JSON-store
- changing webhook payload contract
- changing webhook signing contract
- changing retry/backoff policy beyond matching existing behavior
- adding real merchant webhook endpoint management UI
- partial payment or overpayment accounting

## Proposed feature flag

Add a narrow webhook write flag:

- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

Reason:

- webhook writes are the next storage boundary after terminal payment states
- retry/replay persistence can migrate without removing JSON fallback
- webhook delivery writes should be proven separately from terminal payment
  transitions

## Target endpoints

Primary terminal paths that should create deliveries:

- `POST /api/v1/payments/mock/chain-confirmation`
- `POST /api/v1/payments/mock/chain-failure`
- `POST /api/v1/payments/mock/observations/:observationId/confirm`
- `POST /api/v1/payments/mock/observations/:observationId/fail`
- `POST /api/v1/payments/:paymentId/finalize`
- `POST /api/v1/payments/:paymentId/fail`
- `POST /api/v1/arc/webhooks/finality`

Webhook operator paths:

- `GET /api/v1/payments/webhook-deliveries`
- `POST /api/v1/payments/webhook-deliveries/:deliveryId/retry`
- `POST /api/v1/payments/:paymentId/webhook-replay`

## Acceptance criteria

Day 11 is complete when:

- [x] Prisma method exists for creating webhook deliveries
- [x] Prisma method exists for attempting persisted deliveries
- [x] Prisma method exists for retrying deliveries
- [x] Prisma method exists for replaying payment webhook events
- [x] Prisma read path exists for listing webhook deliveries and queue meta
- [x] delivery creation is behind `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- [x] retry/replay write path is behind `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- [x] JSON fallback remains default when the flag is absent
- [x] finalized payment emits `payment.finalized` delivery in Postgres
- [x] failed payment emits `payment.failed` delivery in Postgres
- [x] disabled delivery state works when no webhook URL is configured
- [x] failed delivery state works when endpoint returns non-2xx or fetch fails
- [x] delivered state works when endpoint returns 2xx
- [x] retry updates attempt count and nextAttemptAt/deadLetteredAt correctly
- [x] replay creates a new delivery linked by `replayOfDeliveryId`
- [x] webhook delivery timeline events are visible through `postgres_reads`
- [x] webhook delivery list and dead-letter filters work with Postgres reads
- [x] temporary smoke records are cleaned after verification
- [x] API build/typecheck/test remain green
- [x] Arc finalized/failed regressions remain green

## Safety rules

- Keep JSON fallback.
- Do not change webhook payload shape unless a bug requires it.
- Do not change webhook signature semantics.
- Do not remove existing webhook retry/backoff behavior.
- Do not remove existing seed data.
- Clean temporary smoke records after verification unless intentionally kept.
- Run API regressions after every write-path change.

## Implementation slices

### Slice 1

Create the Day 11 execution plan and choose the write target.

Chosen target:

- webhook delivery persistence through Prisma

Chosen feature flag:

- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

Reason:

- invoice creation is already Postgres-backed behind a flag
- payment-session creation is already Postgres-backed behind a flag
- raw ingestion and matching are already Postgres-backed behind a flag
- terminal finalized/failed transitions are already Postgres-backed behind a flag
- webhook delivery writes are the next runtime persistence boundary

Slice 1 progress:

- Day 11 execution plan created
- target selected:
  - webhook delivery creation
  - delivery attempt state
  - retry state
  - replay state
  - dead-letter state
- narrow write flag proposed:
  - `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- JSON fallback explicitly preserved
- production Arc provider setup explicitly deferred

### Slice 2

Add Prisma repository support for webhook delivery creation and attempt state.

The repository should:

- create `webhook_delivery`
- build delivery payload from Postgres invoice/payment/observation
- persist eventId and eventCreatedAt
- persist payment/invoice status snapshots
- persist destination and signature attempt data
- update attemptCount
- update response fields
- compute nextAttemptAt/deadLetteredAt
- write webhook delivery payment events
- return the same API response shape as the JSON path

Slice 2 progress:

- `WebhookDeliveryRepository` added and exported from `StorageModule`
- repository can create Postgres `webhook_delivery` records from:
  - payment
  - invoice
  - linked observation
- delivery creation preserves:
  - eventId
  - eventCreatedAt
  - eventType
  - paymentStatusSnapshot
  - invoiceStatusSnapshot
  - replayOfDeliveryId
  - maxAttempts
  - JSON payload shape compatible with the JSON runtime
- repository can update persisted delivery attempt state:
  - status
  - destination
  - signature
  - attemptCount
  - responseStatus
  - responseBody
  - errorMessage
  - lastAttemptAt
  - nextAttemptAt
  - deliveredAt
  - deadLetteredAt
- retry backoff mirrors the JSON runtime:
  - exponential delay
  - capped at 60 seconds
- dead-letter transition is supported when attempts reach `maxAttempts`
- attempt updates create payment timeline events:
  - `webhook_delivery_succeeded`
  - `webhook_delivery_failed`
- API response serialization maps Prisma webhook enums back to the existing
  dotted event type shape:
  - `payment.finalized`
  - `payment.failed`
- endpoint/service wiring remains deferred to Slice 3 and Slice 5

### Slice 3

Wire terminal Postgres paths to create webhook deliveries.

Connect delivery creation after terminal transitions for:

- finalized payments
- failed payments

Keep terminal payment writes and webhook delivery writes independently gated:

- terminal state:
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- webhook delivery:
  - `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

Slice 3 progress:

- terminal Postgres paths now create webhook deliveries when
  `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres` is enabled
- terminal payment writes and webhook delivery writes remain independently
  gated:
  - terminal transitions use `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
  - webhook delivery writes use `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- wired Postgres webhook creation after finalized transitions:
  - admin finalize
  - mock chain confirmation
  - matched observation confirmation
  - Arc finality finalized event
- wired Postgres webhook creation after failed transitions:
  - admin fail
  - mock chain failure
  - matched observation failure
  - Arc finality failed event
- first delivery attempt is executed immediately after delivery creation
- disabled delivery state is supported when no webhook URL is configured
- JSON fallback remains default when webhook write flag is absent
- list/read, retry, and replay remain deferred to later slices

### Slice 4

Add Prisma list/read support for webhook deliveries.

Support:

- all deliveries
- status filters
- active queue filter
- dead-letter queue filter
- meta counters:
  - total
  - active
  - deadLetter
  - disabled
  - delivered

Slice 4 progress:

- Postgres webhook delivery list/read method added to
  `WebhookDeliveryRepository`
- `GET /api/v1/payments/webhook-deliveries` now reads Postgres deliveries when
  `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres` is enabled
- JSON delivery list remains the default when the webhook write flag is absent
- supported filters:
  - status filter
  - `queue=all`
  - `queue=active`
  - `queue=dead_letter`
- supported meta counters:
  - total
  - active
  - deadLetter
  - disabled
  - delivered
- response serialization keeps existing API shape:
  - dotted event types
  - ISO timestamps
  - `isTerminal`
- retry and replay remain deferred to Slice 5

### Slice 5

Add Prisma retry and replay support.

Support:

- retry existing delivery
- replay latest finalized/failed payment delivery
- create replay delivery with `replayOfDeliveryId`
- preserve payload/event id behavior from the JSON path
- preserve delivery signing and attempt behavior

Slice 5 progress:

- Postgres retry support added:
  - finds delivery by id and organization id
  - reuses existing payload
  - signs and attempts delivery through the same HTTP logic as initial dispatch
  - updates attempt state through Prisma
- Postgres replay support added:
  - validates payment ownership by organization id
  - supports only finalized/failed payments
  - finds latest matching delivery for the payment/event type
  - creates a new delivery linked by `replayOfDeliveryId` when a previous
    delivery exists
  - preserves previous eventId and eventCreatedAt when replaying an existing
    event
  - creates a fresh event when no prior delivery exists
- existing endpoints now route to Postgres when
  `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres` is enabled:
  - `POST /api/v1/payments/webhook-deliveries/:deliveryId/retry`
  - `POST /api/v1/payments/:paymentId/webhook-replay`
- JSON retry/replay remains default when the webhook write flag is absent
- delivery signing and attempt behavior are preserved

### Slice 6

Run webhook smoke.

Verify:

- finalized payment creates webhook delivery in Postgres
- failed payment creates webhook delivery in Postgres
- disabled state works with no webhook URL
- retry updates attempt count
- replay creates linked delivery
- operator delivery list sees records through Postgres
- dead-letter queue filter still works

Slice 6 progress:

- webhook API smoke was run through real HTTP endpoints on a temporary local
  port with these flags:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
  - `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- smoke verified finalized webhook path:
  - Postgres invoice creation
  - Postgres hosted payment-session creation
  - raw event ingestion
  - exact match to `processing`
  - terminal finalization
  - `payment.finalized` delivery creation
  - first delivery attempt
  - disabled state with no webhook URL
- smoke verified failed webhook path:
  - Postgres invoice creation
  - Postgres hosted payment-session creation
  - raw event ingestion
  - exact match to `processing`
  - terminal failure
  - `payment.failed` delivery creation
  - first delivery attempt
  - disabled state with no webhook URL
- retry smoke verified:
  - existing Postgres delivery can be retried
  - attemptCount increments
  - retry uses the existing payload
- replay smoke verified:
  - replay creates a new delivery
  - replay links to the latest delivery through `replayOfDeliveryId`
  - replay preserves the event type
- operator list smoke verified:
  - all-deliveries list includes Postgres deliveries
  - active queue includes disabled deliveries
  - dead-letter queue filter works
- note:
  - the no-webhook-URL path resolves to `disabled`, so this smoke validated the
    dead-letter queue filter but did not force a dead-letter transition
- temporary smoke records were cleaned after verification
- seed data remained intact after cleanup
- API regression test remained green

### Slice 7

Document Day 11 acceptance and next target.

Likely next target:

- production hardening or Arc provider setup

Decision rule:

- only start production Arc provider setup after Postgres runtime writes are
  stable end to end
- consider a hardening day first if webhook smoke reveals reliability gaps

Slice 7 progress:

- Day 11 acceptance note added
- execution plan marked completed
- acceptance checklist closed
- README status updated with the Postgres webhook write boundary
- next recommended target captured:
  - production hardening pass
  - or production Arc provider setup after the runtime boundary remains stable
