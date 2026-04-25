# Stablebooks Day 10 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Postgres terminal payment transition migration`
- Status: `completed`

## Goal

Day 10 moves terminal payment state transitions toward Prisma/Postgres:

- `processing -> finalized`
- `processing -> failed`

The goal is to support the path:

1. invoice exists in Postgres
2. hosted payment session exists in Postgres
3. raw chain event is ingested into Postgres
4. observation is matched to payment/invoice
5. payment reaches `processing`
6. confirmation or failure is received
7. payment moves to `finalized` or `failed`
8. invoice moves to `paid` only for finalized payments
9. operator sees terminal state and timeline through `postgres_reads`

Day 10 intentionally keeps webhook delivery writes out of scope.

## Day 10 scope

Day 10 includes:

- Prisma write support for payment finalization
- Prisma write support for payment failure
- terminal status monotonicity for finalized/failed transitions
- payment confirmation evidence storage:
  - settlementReference
  - confirmationSource
  - confirmationTxHash
  - confirmationBlockNumber
  - sourceConfirmedAt
  - confirmationReceivedAt
  - confirmedAt
  - finalizedAt
- failure evidence storage:
  - failureReason
  - confirmationSource when provided
  - confirmationTxHash when provided
  - confirmationBlockNumber when provided
  - sourceConfirmedAt when provided
  - confirmationReceivedAt when provided
- invoice status update:
  - finalized payment moves invoice to `paid`
  - failed payment does not move invoice to `paid`
- business timeline events:
  - `payment_confirmation_received`
  - `payment_finalized`
  - `payment_failure_received`
  - `payment_failed`
- API smoke for mock confirmation and mock failure
- preserving JSON fallback
- preserving Arc finalized/failed regressions

Day 10 does not include:

- webhook delivery writes through Prisma
- webhook retry/replay migration to Prisma
- removing JSON-store
- production Arc provider setup
- partial payment or overpayment accounting
- multi-payment invoice aggregation beyond the current MVP model

## Proposed feature flag

Add a narrow terminal transition flag:

- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`

Reason:

- terminal transitions are riskier than matching
- webhooks depend on terminal transitions but should migrate separately
- JSON fallback remains available while Postgres terminal paths are proven

## Target endpoints

Primary finalize smoke targets:

- `POST /api/v1/payments/mock/chain-confirmation`
- `POST /api/v1/payments/mock/observations/:observationId/confirm`

Primary failure smoke targets:

- `POST /api/v1/payments/mock/chain-failure`
- `POST /api/v1/payments/mock/observations/:observationId/fail`

Admin endpoints to keep compatible:

- `POST /api/v1/payments/:paymentId/finalize`
- `POST /api/v1/payments/:paymentId/fail`

Arc-shaped paths to keep compatible:

- `POST /api/v1/arc/webhooks/finality`

Webhook persistence remains out of scope:

- webhook delivery creation
- webhook retry/replay persistence
- dead-letter writes

## Acceptance criteria

Day 10 is complete when:

- [x] Prisma method exists for terminal finalization
- [x] Prisma method exists for terminal failure
- [x] finalization is behind `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- [x] failure is behind `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- [x] JSON fallback remains default when the flag is absent
- [x] `processing -> finalized` updates payment evidence fields
- [x] `processing -> finalized` moves invoice to `paid`
- [x] finalization writes `payment_confirmation_received`
- [x] finalization writes `payment_finalized`
- [x] `processing -> failed` updates failure evidence fields
- [x] `processing -> failed` keeps invoice non-paid
- [x] failure writes `payment_failure_received`
- [x] failure writes `payment_failed`
- [x] repeated terminal calls are idempotent enough for MVP smoke
- [x] terminal states are visible through `postgres_reads`
- [x] temporary smoke records are cleaned after verification
- [x] API build/typecheck/test remain green
- [x] Arc finalized/failed regressions remain green

## Safety rules

- Keep JSON fallback.
- Do not switch webhook delivery persistence to Prisma.
- Do not remove existing seed data.
- Do not change finalized/failed response shape unless required by an existing
  bug.
- Do not let `failed -> finalized` or `finalized -> failed` happen silently.
- Clean temporary smoke records after verification unless intentionally kept.
- Run API regressions after every write-path change.

## Implementation slices

### Slice 1

Create the Day 10 execution plan and choose the write target.

Chosen target:

- terminal payment transitions through Prisma

Chosen feature flag:

- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`

Reason:

- invoice creation is already Postgres-backed behind a flag
- payment-session creation is already Postgres-backed behind a flag
- raw ingestion and matching are already Postgres-backed behind a flag
- terminal transitions are the next payment-runtime boundary
- webhook writes should wait until terminal transitions are stable

Slice 1 progress:

- Day 10 execution plan created
- target selected:
  - `processing -> finalized`
  - `processing -> failed`
- narrow write flag proposed:
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- webhook delivery writes explicitly deferred
- JSON fallback explicitly preserved

### Slice 2

Add Prisma repository support for payment finalization.

The repository should:

- find a payment by id or matched observation
- require organization ownership when called from admin context
- reject missing payments
- prevent finalized/failed status reversal
- write confirmation evidence fields
- move payment to `finalized`
- move invoice to `paid`
- write `payment_confirmation_received`
- write `payment_finalized`
- return the same API response shape as the JSON path

Slice 2 progress:

- Postgres finalization method added to `WorkspaceReadRepository`
- finalization can locate payment by:
  - `paymentId`
  - payment or invoice `publicToken`
  - matched `observationId`
- optional `organizationId` scopes admin-owned lookups
- missing payments return not-found
- `failed -> finalized` is rejected
- already-finalized payments are treated as idempotent no-op reads
- pending payments are moved through `processing` before finalization
- finalization writes confirmation evidence:
  - settlementReference
  - confirmationSource
  - confirmationTxHash
  - confirmationBlockNumber
  - sourceConfirmedAt
  - confirmationReceivedAt
  - confirmedAt
  - finalizedAt
- invoice moves to `paid`
- linked observation moves to `confirmed`
- timeline writes:
  - `payment_confirmation_received`
  - `payment_finalized`
- endpoint wiring remains deferred to Slice 4

### Slice 3

Add Prisma repository support for payment failure.

The repository should:

- find a payment by id or matched observation
- require organization ownership when called from admin context
- reject missing payments
- prevent finalized/failed status reversal
- write failure evidence fields
- move payment to `failed`
- keep invoice non-paid
- write `payment_failure_received`
- write `payment_failed`
- return the same API response shape as the JSON path

Slice 3 progress:

- Postgres failure method added to `WorkspaceReadRepository`
- failure can locate payment by:
  - `paymentId`
  - payment or invoice `publicToken`
  - matched `observationId`
- optional `organizationId` scopes admin-owned lookups
- missing payments return not-found
- `finalized -> failed` is rejected
- already-failed payments are treated as idempotent no-op reads
- pending payments are moved through `processing` before failure
- failure writes evidence:
  - failureReason
  - failureSource
  - confirmationTxHash
  - confirmationBlockNumber
  - sourceConfirmedAt
  - confirmationReceivedAt
  - confirmedAt
- invoice is not moved to `paid`
- linked observation moves to `rejected`
- timeline writes:
  - `payment_failure_received`
  - `payment_failed`
- endpoint wiring remains deferred to Slice 4

### Slice 4

Wire terminal endpoints behind the feature flag.

Connect Postgres terminal paths to:

- `POST /api/v1/payments/mock/chain-confirmation`
- `POST /api/v1/payments/mock/observations/:observationId/confirm`
- `POST /api/v1/payments/mock/chain-failure`
- `POST /api/v1/payments/mock/observations/:observationId/fail`

Keep admin endpoints compatible:

- `POST /api/v1/payments/:paymentId/finalize`
- `POST /api/v1/payments/:paymentId/fail`

Slice 4 progress:

- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres` now routes terminal
  transitions through Prisma
- admin terminal endpoints are wired:
  - `POST /api/v1/payments/:paymentId/finalize`
  - `POST /api/v1/payments/:paymentId/fail`
- mock chain terminal endpoints are wired:
  - `POST /api/v1/payments/mock/chain-confirmation`
  - `POST /api/v1/payments/mock/chain-failure`
- matched observation terminal endpoints are wired:
  - `POST /api/v1/payments/mock/observations/:observationId/confirm`
  - `POST /api/v1/payments/mock/observations/:observationId/fail`
- Arc finality webhook path remains compatible:
  - `POST /api/v1/arc/webhooks/finality`
- Postgres Arc finality can refresh observation evidence by:
  - chainId
  - txHash
  - optional logIndex
  - optional blockNumber
  - optional confirmedAt
- webhook delivery writes remain outside the Postgres terminal path
- JSON fallback remains default when the terminal flag is absent

### Slice 5

Run finalize smoke.

Verify:

- create Postgres invoice
- start Postgres payment session
- ingest mock raw chain event
- exact-match to `processing`
- trigger mock confirmation
- payment becomes `finalized`
- invoice becomes `paid`
- timeline includes `payment_confirmation_received`
- timeline includes `payment_finalized`
- terminal fields are visible through `postgres_reads`

Slice 5 progress:

- finalize API smoke was run through real HTTP endpoints on a temporary local
  port with these flags:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- smoke verified:
  - Postgres invoice creation
  - Postgres hosted payment-session creation
  - raw event ingestion
  - exact match to `processing`
  - mock chain confirmation through Prisma
  - payment `finalized`
  - invoice `paid`
  - persisted settlementReference
  - persisted confirmationSource
  - persisted confirmationTxHash
  - persisted confirmationBlockNumber
  - persisted terminal timestamps
  - `payment_confirmation_received` timeline event
  - `payment_finalized` timeline event
- temporary smoke records were cleaned after verification
- seed data remained intact after cleanup
- API regression test remained green

### Slice 6

Run failure smoke.

Verify:

- create Postgres invoice
- start Postgres payment session
- ingest mock raw chain event
- exact-match to `processing`
- trigger mock failure
- payment becomes `failed`
- invoice does not become `paid`
- timeline includes `payment_failure_received`
- timeline includes `payment_failed`
- failure fields are visible through `postgres_reads`

Slice 6 progress:

- failure API smoke was run through real HTTP endpoints on a temporary local
  port with these flags:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- smoke verified:
  - Postgres invoice creation
  - Postgres hosted payment-session creation
  - raw event ingestion
  - exact match to `processing`
  - mock chain failure through Prisma
  - payment `failed`
  - invoice remained non-paid
  - persisted failureReason
  - persisted confirmationSource
  - persisted confirmationTxHash
  - persisted confirmationBlockNumber
  - settlementReference remained null
  - finalizedAt remained null
  - persisted failure timestamps
  - `payment_failure_received` timeline event
  - `payment_failed` timeline event
- temporary smoke records were cleaned after verification
- seed data remained intact after cleanup
- API regression test remained green

### Slice 7

Document Day 10 acceptance and next target.

Likely next target:

- webhook delivery writes through Prisma

Decision rule:

- only start webhook writes after terminal finalized/failed smoke is stable
- keep production Arc provider setup separate from storage migration

Slice 7 progress:

- Day 10 acceptance criteria marked complete
- Day 10 status moved to `completed`
- separate acceptance note added:
  - `docs/day-10-acceptance-note.md`
- next target selected:
  - webhook delivery writes through Prisma
- next target boundary preserved:
  - production Arc provider setup remains separate from storage migration
