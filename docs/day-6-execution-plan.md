# Stablebooks Day 6 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Incremental Postgres runtime migration`
- Status: `completed`

## Goal

Day 6 should begin the real runtime migration from JSON-store toward
Prisma/Postgres without risking the accepted Arc payment flow.

The goal is not to flip the whole backend to Postgres in one move. The goal is
to establish a safe runtime migration strategy, add read repositories first,
prove UI/API reads against Postgres, and keep the Arc finalized/failed
regression suite green after every slice.

## Runtime migration strategy

Stablebooks should move through explicit storage modes instead of an implicit
rewrite.

### Mode 1: `json`

Current safe default.

- JSON-store is the source of truth for reads and writes.
- Existing UI and payment flows continue working.
- Postgres readiness can still be checked.
- Arc evidence mirror is disabled unless separately enabled.

This is the fallback mode.

### Mode 2: `json` + `postgres_shadow`

Current Day 5 bridge mode.

- JSON-store remains the source of truth for payment runtime.
- Arc raw evidence and normalized observations are mirrored into Postgres.
- Mirror writes are visible through `postgresMirror` metadata.
- The purpose is verification, not serving user-facing reads.

Enable with:

- `STABLEBOOKS_STORAGE_MODE=json`
- `STABLEBOOKS_ARC_EVIDENCE_MIRROR=postgres_shadow`

### Mode 3: `postgres_reads`

Day 6 target mode.

- Selected read endpoints can serve from Postgres.
- Writes still stay on the existing JSON-backed runtime unless a later slice
  explicitly moves them.
- This mode should start with low-risk read surfaces:
  - workspace summary
  - invoice list
  - invoice detail
  - payment detail when seed parity is ready

Enable with:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`

### Mode 4: `postgres`

Future target, not Day 6 default.

- Postgres becomes the source of truth for reads and writes.
- JSON-store is no longer required for payment state.
- Arc regressions must pass without JSON payment runtime dependency.

This should only be enabled after read parity, write repositories, webhook
delivery persistence, and UI smoke are proven.

## Day 6 scope

Day 6 includes:

- documenting storage mode strategy
- adding Prisma read repositories for core workspace/payment data
- adding a storage mode switch for selected read endpoints
- strengthening Postgres seed parity for UI smoke
- proving selected operator screens can read from Postgres
- keeping Arc finalized/failed regressions green

Day 6 does not include:

- full write-path migration
- deleting JSON-store
- partial payment or overpayment accounting
- production Arc provider account setup
- analytics/reporting surfaces

## Safety rules

- Do not switch writes to Postgres until read parity is stable.
- Do not remove JSON fallback.
- Do not change Arc finalized/failed behavior unless regression tests are
  updated and still pass.
- After every meaningful slice, run:
  - `corepack pnpm --filter @stablebooks/api build`
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`
- If web read paths are touched, also run:
  - `corepack pnpm --filter @stablebooks/web build`
  - `corepack pnpm --filter @stablebooks/web typecheck`

## Acceptance criteria

Day 6 is complete when:

- runtime storage modes are documented
- Prisma read repositories exist for the first selected core entities
- `STABLEBOOKS_STORAGE_MODE=postgres_reads` is supported for at least one
  operator-facing read endpoint
- Postgres seed creates enough data for that endpoint to be useful
- API build/typecheck/test remain green
- existing Arc finalized/failed regressions still pass
- JSON mode remains available as fallback

## Implementation slices

### Slice 1

Document the runtime migration strategy and acceptance criteria.

Slice 1 progress:

- Day 6 execution plan created
- storage modes documented:
  - `json`
  - `json + postgres_shadow`
  - `postgres_reads`
  - future `postgres`
- safety rules documented
- Day 6 acceptance criteria documented

### Slice 2

Add Prisma read repositories for core workspace data.

Start with:

- organizations
- wallets
- customers
- invoices
- payments

The repository should normalize Prisma records into the same DTO shape the web
app already expects from JSON-backed services.

Slice 2 progress:

- added `WorkspaceReadRepository`
- repository currently provides Postgres read methods for:
  - current organization by id
  - wallets list
  - customers list
  - customer detail with invoices
  - invoices list
  - invoice detail with customer, payments, and timeline
  - payments by invoice
  - payment detail with observation, match, events, and webhook deliveries
- repository normalizes Prisma `Date` values into ISO strings for API/web DTO
  compatibility
- repository maps `metadataJson` to `metadata` for customer DTO compatibility
- added read-only Postgres workspace smoke endpoint:
  - `GET /api/v1/health/postgres-workspace`
- local smoke confirmed Postgres seed visibility:
  - organizations: `1`
  - wallets: `1`
  - customers: `1`
  - invoices: `1`
  - payments: `1`
- API build passed
- API typecheck passed
- Arc finalized/failed regression suite passed

### Slice 3

Add `postgres_reads` storage mode switch for one low-risk endpoint.

Preferred first endpoint:

- `GET /api/v1/invoices`

Reason:

- important to the operator UI
- read-only
- does not mutate payment state
- easy to compare against JSON behavior

Slice 3 progress:

- `GET /api/v1/invoices` now supports `postgres_reads`
- switch is controlled by:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- when enabled, invoice list reads from `WorkspaceReadRepository.listInvoices`
- writes remain on the existing JSON-backed runtime
- auth remains on the existing JSON-backed session path for now
- JSON fallback remains the default when storage mode is not `postgres_reads`
- local smoke with `postgres_reads` confirmed:
  - storage mode reported `postgres_reads`
  - invoice list returned Postgres seed invoice `inv_seed_apr_2026`
  - invoice status was `open`
  - latest payment status was `pending`
  - customer name was `Acme Treasury`
- local API was returned to `json` fallback mode after smoke
- API build passed
- API typecheck passed
- Arc finalized/failed regression suite passed

### Slice 4

Strengthen Postgres seed parity.

Seed should support operator UI reads from Postgres:

- user
- session
- organization
- membership
- wallet
- customer
- open invoice
- pending payment

Slice 4 progress:

- strengthened Postgres seed:
  - `apps/api/prisma/seed.js`
- seed now creates Day 6 UI-read parity data:
  - operator user
  - two compatible sessions:
    - `sb_seed_operator_token`
    - `sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484`
  - organization
  - admin membership
  - Arc collection wallet
  - customer
  - open invoice
  - pending payment
  - payment session event with payload
  - disabled webhook endpoint
- seeded invoice now includes:
  - `expectedChainId=777`
  - `expectedToken=USDC`
- JSON dev seed was aligned with the smoke token and Arc expected fields:
  - `apps/api/scripts/seed-dev-store.js`
- local Postgres seed command passed:
  - `corepack pnpm --filter @stablebooks/api db:seed`
- local Postgres verification confirmed:
  - users: `1`
  - sessions: `2`
  - organizations: `1`
  - wallets: `1`
  - customers: `1`
  - invoices: `1`
  - payments: `1`
  - payment events: `1`
  - webhook endpoints: `1`
- `postgres_reads` invoice smoke passed after reseeding
- local API was returned to `json` fallback mode after smoke
- API build passed
- API typecheck passed
- Arc finalized/failed regression suite passed

### Slice 5

Run UI/API smoke against `postgres_reads`.

Verify:

- API invoices endpoint reads from Postgres
- web invoices list renders with the Postgres-backed response
- JSON fallback remains available
- Arc regression tests still pass

Slice 5 progress:

- API was started with:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- API invoice smoke confirmed:
  - storage mode reported `postgres_reads`
  - `GET /api/v1/invoices` returned Postgres seed invoice
  - reference code: `SB-SEED-APR26`
  - customer: `Acme Treasury`
  - invoice status: `open`
  - latest payment status: `pending`
- web invoices UI smoke confirmed:
  - `/invoices` rendered through the running Next app
  - session cookie auth reached the protected app shell
  - invoice table showed `SB-SEED-APR26`
  - customer showed `Acme Treasury`
  - status showed `open`
  - latest payment showed `pending`
  - amount showed `$1,250.00`
- temporary UI smoke HTML artifact was removed
- local API was returned to `json` fallback mode after smoke
- API build passed
- API typecheck passed
- API Arc finalized/failed regression suite passed
- web build passed
- web typecheck passed

### Slice 6

Document Day 6 acceptance and next migration target.

Likely Day 7 theme:

- move invoice/payment writes to Prisma behind explicit mode or repository
  switch

Slice 6 progress:

- Day 6 execution plan marked `completed`
- Day 6 acceptance note added
- docs README updated
- next migration target documented as Day 7:
  - start moving invoice/payment writes to Prisma behind explicit repository
    switches while keeping JSON fallback available
