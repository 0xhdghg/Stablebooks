# Stablebooks Day 7 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `First incremental Postgres write-path migration`
- Status: `completed`

## Goal

Day 7 should begin moving write paths toward Prisma/Postgres without touching
the riskiest money-flow transitions yet.

The goal is to prove one low-risk write path in Postgres while keeping JSON
fallback available and keeping the existing Arc finalized/failed regression
suite green.

## Migration principle

Move writes in this order:

1. low-risk commercial writes
2. payment session creation
3. matching writes
4. terminal payment transitions
5. webhook delivery writes

Do not start with terminal payment transitions. They are the highest-risk path
because they affect invoice settlement state, customer notifications, and
operator audit history.

## Day 7 scope

Day 7 includes:

- Prisma write repository for invoice creation
- storage mode or feature flag for Postgres invoice writes
- API smoke for creating an invoice in Postgres mode
- UI smoke for seeing the created invoice through `postgres_reads`
- preserving JSON fallback
- preserving Arc finalized/failed regressions

Day 7 does not include:

- terminal payment transitions through Prisma
- webhook delivery writes through Prisma
- deleting JSON-store
- production Arc provider setup
- partial payment or overpayment accounting

## Proposed storage modes

Current modes remain valid:

- `json`
- `json + postgres_shadow`
- `postgres_reads`

Day 7 may add a narrow write flag:

- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`

This is intentionally narrower than `STABLEBOOKS_STORAGE_MODE=postgres`.

Reason:

- it lets invoice creation move independently
- reads can still be tested through `postgres_reads`
- payment runtime can stay protected on JSON until write coverage grows

## Acceptance criteria

Day 7 is complete when:

- Prisma write repository exists for invoice creation
- invoice create endpoint can write to Postgres behind an explicit flag
- created Postgres invoice appears in `GET /api/v1/invoices` under
  `postgres_reads`
- JSON invoice creation fallback still works when the flag is disabled
- API build/typecheck/test remain green
- web build/typecheck remain green if UI smoke is touched
- Arc finalized/failed regressions remain green

## Safety rules

- Keep JSON fallback.
- Do not switch terminal payment transitions to Prisma.
- Do not change webhook delivery persistence.
- Do not remove existing seed data.
- Clean temporary smoke invoices after verification unless intentionally kept.
- Run API regressions after every write-path change.

## Implementation slices

### Slice 1

Create the Day 7 execution plan and choose the first write target.

Chosen first target:

- `POST /api/v1/invoices`

Reason:

- it is commercially important
- it is lower risk than payment finalization/failure
- it can be verified through existing `postgres_reads` invoice list
- it does not require Arc event ingestion to prove the write path

Slice 1 progress:

- Day 7 execution plan created
- first write target selected:
  - invoice creation
- narrow write flag proposed:
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- terminal payment transitions explicitly deferred

### Slice 2

Add Prisma write repository support for invoice creation.

The repository should:

- validate customer belongs to organization
- create invoice with public token and reference code supplied by service
- support `open` or `draft` status
- preserve existing API DTO shape

Slice 2 progress:

- Postgres invoice create method added to `WorkspaceReadRepository`
- customer ownership validation added before write
- service-supplied `id`, `publicToken`, and `referenceCode` are preserved
- `draft` and `open` invoice creation are supported
- existing invoice DTO shape is preserved
- endpoint wiring is intentionally deferred to Slice 3

### Slice 3

Wire `POST /api/v1/invoices` to Postgres behind:

- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`

Fallback behavior:

- when flag is absent, current JSON write path remains unchanged

Slice 3 progress:

- `POST /api/v1/invoices` now routes to Prisma invoice creation when
  `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- JSON invoice creation remains the default path when the flag is absent
- existing request validation and response DTO shape are preserved

### Slice 4

Run API smoke for Postgres invoice creation.

Verify:

- create invoice with authenticated operator token
- response contains Postgres-created invoice
- `GET /api/v1/invoices` in `postgres_reads` shows the new invoice
- JSON fallback can still create invoice when flag is disabled

Slice 4 progress:

- temporary API was started from `apps/api` on port `4100`
- Postgres write/read smoke passed with:
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- created Postgres invoice was visible through `GET /api/v1/invoices`
- JSON fallback invoice creation was verified with the write flag disabled
- temporary smoke invoice and temporary files were removed after verification

### Slice 5

Run UI smoke.

Verify:

- create invoice flow still works when pointed at the chosen write mode
- invoice list renders created invoice through `postgres_reads`

Slice 5 progress:

- web production build and typecheck passed before smoke
- temporary API was started on port `4100` with Postgres invoice writes and
  `postgres_reads`
- temporary Next production server was started on port `3100`
- `/invoices/new` rendered authenticated UI and loaded the seed customer
- a Postgres invoice created through the API appeared in the `/invoices` UI
- smoke exposed a detail-read gap:
  - `GET /api/v1/invoices/:invoiceId` still used JSON-store
- detail-read gap was fixed by routing invoice detail reads through Postgres
  when `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `/invoices/:invoiceId` rendered the Postgres-created invoice successfully
- temporary smoke invoice, logs, HTML captures, and servers were cleaned up

### Slice 6

Document Day 7 acceptance and next target.

Likely next target:

- payment session creation through Prisma

Slice 6 progress:

- Day 7 acceptance note created
- execution plan status moved to `completed`
- next write-path target selected:
  - payment session creation through Prisma
- JSON fallback remains the default runtime path
- terminal payment transitions remain intentionally out of scope
