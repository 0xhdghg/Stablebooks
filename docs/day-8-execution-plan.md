# Stablebooks Day 8 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Postgres payment session write-path migration`
- Status: `completed`

## Goal

Day 8 moves the next low-risk write path toward Prisma/Postgres:

- `POST /api/v1/public/invoices/:publicToken/payment-session`

The goal is to create hosted payment sessions in Postgres behind an explicit
feature flag while keeping terminal payment transitions, matching, and webhook
delivery writes on the current JSON runtime.

This is the right next step after Day 7 because invoice creation can already
write to Postgres and invoice list/detail can read from Postgres in
`postgres_reads`.

## Day 8 scope

Day 8 includes:

- Prisma write support for payment session creation
- payment session creation behind a narrow feature flag
- payment event creation for `payment_session_created`
- invoice status update from `open` to `processing`
- API smoke for hosted invoice payment-session creation
- operator invoice detail smoke through `postgres_reads`
- hosted UI smoke for `/pay/:publicToken`
- preserving JSON fallback
- preserving Arc finalized/failed regressions

Day 8 does not include:

- payment matching writes through Prisma
- terminal payment finalization through Prisma
- terminal payment failure through Prisma
- webhook delivery writes through Prisma
- deleting JSON-store
- production Arc provider setup
- partial payment or overpayment accounting

## Proposed feature flag

Add a narrow write flag:

- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`

Reason:

- payment session creation can move independently
- terminal payment transitions can stay protected on JSON
- hosted payment flow can be smoked without moving the whole public runtime

## Acceptance criteria

Day 8 is complete when:

- Prisma write method exists for payment session creation
- payment session endpoint can write to Postgres behind
  `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- JSON payment session fallback still works when the flag is absent
- created Postgres payment appears in invoice detail through `postgres_reads`
- a `payment_session_created` domain event is stored in Postgres
- invoice moves to `processing` after payment session creation
- hosted UI can start a payment session from `/pay/:publicToken`
- API build/typecheck/test remain green
- web build/typecheck remain green if UI smoke is touched
- Arc finalized/failed regressions remain green

## Safety rules

- Keep JSON fallback.
- Do not switch payment finalization to Prisma.
- Do not switch payment failure to Prisma.
- Do not switch webhook delivery persistence to Prisma.
- Do not remove existing seed data.
- Clean temporary smoke records after verification unless intentionally kept.
- Run API regressions after every write-path change.

## Implementation slices

### Slice 1

Create the Day 8 execution plan and choose the write target.

Chosen target:

- `POST /api/v1/public/invoices/:publicToken/payment-session`

Reason:

- it is the next natural write after invoice creation
- it is needed by the hosted customer payment flow
- it creates payment state but does not finalize money movement
- it can be verified through existing `postgres_reads` invoice detail

Slice 1 progress:

- Day 8 execution plan created
- first write target selected:
  - hosted payment session creation
- narrow write flag proposed:
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- terminal payment transitions explicitly deferred
- webhook delivery writes explicitly deferred

### Slice 2

Add Prisma write repository support for payment session creation.

The repository should:

- find payable invoice by `publicToken`
- reject missing or `draft` invoices
- return finalized redirect data if invoice is already `paid`
- reuse existing `pending` or `processing` payment if one exists
- create a new `pending` payment when needed
- create a `payment_session_created` payment event
- move invoice to `processing`
- preserve existing endpoint response shape

Slice 2 progress:

- Postgres payment session create method added to `WorkspaceReadRepository`
- payable invoice lookup by invoice `publicToken` added
- missing and `draft` invoices are rejected as public-not-found
- existing `pending` or `processing` payments are reused
- `paid` invoices and finalized latest payments return success redirect data
- new sessions create:
  - `pending` payment
  - `payment_session_created` event
  - `processing` invoice status
- endpoint wiring is intentionally deferred to Slice 3

### Slice 3

Wire `POST /api/v1/public/invoices/:publicToken/payment-session` to Postgres
behind:

- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`

Fallback behavior:

- when flag is absent, current JSON write path remains unchanged

Slice 3 progress:

- `POST /api/v1/public/invoices/:publicToken/payment-session` now routes to
  Prisma payment-session creation when
  `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- JSON payment-session creation remains the default path when the flag is
  absent
- service-generated `paymentId`, payment public token, and payment event id are
  supplied to the repository
- existing endpoint response shape is preserved

### Slice 4

Run API smoke for Postgres payment session creation.

Verify:

- create an invoice in Postgres mode
- start payment session through the public endpoint
- response contains `paymentId`, `status`, and `redirectPath`
- invoice detail in `postgres_reads` shows the payment
- invoice timeline includes `payment_session_created`
- JSON fallback still creates payment session when the flag is disabled

Slice 4 progress:

- temporary API was started from `apps/api` on port `4100`
- Postgres write/read smoke passed with:
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- created Postgres invoice successfully started a public payment session
- response included `paymentId`, `pending` status, and processing redirect
- invoice detail in `postgres_reads` showed:
  - invoice status moved to `processing`
  - created `pending` payment
  - `payment_session_created` timeline event
- repeated payment-session call reused the same pending payment
- JSON fallback payment-session creation was verified with the write flag
  disabled
- temporary smoke invoice, cascaded payment/event records, logs, and server were
  cleaned up

### Slice 5

Run hosted UI smoke.

Verify:

- `/pay/:publicToken` renders the hosted invoice
- starting payment session returns the expected processing redirect
- operator invoice detail shows the created payment through `postgres_reads`

Slice 5 progress:

- hosted UI smoke exposed the expected JSON/Postgres public-read split:
  - `/pay/:publicToken` and public status reads still used JSON-store
- public invoice and public status reads now route through Postgres when
  `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- public payment poller no longer hardcodes port `4000`; it uses
  `NEXT_PUBLIC_API_BASE_URL` with the existing local default fallback
- web production build and typecheck passed
- temporary API was started on port `4100` with:
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- temporary Next production server was started on port `3100`
- `/pay/:publicToken` rendered the Postgres-created hosted invoice
- payment session start returned the expected processing redirect
- `/pay/:publicToken/processing` rendered the pending payment status
- operator invoice detail rendered the created payment and
  `payment_session_created` event
- temporary smoke invoice, cascaded payment/event records, logs, HTML captures,
  and servers were cleaned up

### Slice 6

Document Day 8 acceptance and next target.

Likely next target:

- public hosted invoice reads through Postgres
- or matching writes through Prisma

Decision rule:

- choose hosted invoice reads first if UI smoke exposes JSON/Postgres split
- choose matching writes first if hosted reads are already safe enough

Slice 6 progress:

- Day 8 acceptance note created
- execution plan status moved to `completed`
- hosted invoice public reads were completed during Slice 5 because UI smoke
  exposed the JSON/Postgres split
- next write-path target selected:
  - matching writes through Prisma
- terminal payment finalization/failure remain intentionally out of scope
- webhook delivery writes remain intentionally out of scope
