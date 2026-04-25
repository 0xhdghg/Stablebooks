# Stablebooks Day 6 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Incremental Postgres runtime migration`
- Status: `accepted`

## Acceptance summary

Day 6 is accepted for the current MVP stage.

Stablebooks now has a safe first slice of Postgres-backed runtime reads. The
full payment runtime still keeps JSON as the default source of truth, but the
project can now run a selected operator-facing endpoint from Postgres through an
explicit `postgres_reads` mode.

The important achievement is controlled migration: reads can move first, UI can
be smoke-tested against Postgres, and the Arc finalized/failed money-flow tests
remain green.

## Accepted capabilities

- Runtime storage modes are documented:
  - `json`
  - `json + postgres_shadow`
  - `postgres_reads`
  - future `postgres`
- `WorkspaceReadRepository` exists for Postgres read access.
- Repository read coverage includes:
  - organization
  - wallets
  - customers
  - invoices
  - payments
  - invoice detail
  - payment detail
- Prisma records are normalized into API/web-compatible DTOs.
- `GET /api/v1/health/postgres-workspace` exposes a read-only Postgres workspace
  summary.
- `GET /api/v1/invoices` supports:
  - JSON reads by default
  - Postgres reads when `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- Postgres seed creates UI-read parity data:
  - operator user
  - compatible smoke sessions
  - organization
  - membership
  - Arc collection wallet
  - customer
  - open invoice
  - pending payment
  - payment session event
  - disabled webhook endpoint
- JSON dev seed was aligned with the same smoke token and Arc expected fields.
- API can still be returned to `json` fallback mode after Postgres-read smoke.

## Verified checks

The following checks passed locally:

- `corepack pnpm --filter @stablebooks/api db:seed`
- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- `corepack pnpm --filter @stablebooks/web build`
- `corepack pnpm --filter @stablebooks/web typecheck`

## Verified smoke

### API smoke

With `STABLEBOOKS_STORAGE_MODE=postgres_reads`, the API invoice list returned
the Postgres seed invoice:

- reference: `SB-SEED-APR26`
- customer: `Acme Treasury`
- invoice status: `open`
- latest payment status: `pending`

### UI smoke

With the API in `postgres_reads`, the running Next app rendered `/invoices`
through the protected app shell and showed:

- `SB-SEED-APR26`
- `Acme Treasury`
- `open`
- `pending`
- `$1,250.00`

After smoke, the API was returned to `json` fallback mode.

## Current boundaries

Day 6 does not yet mean the full runtime is Postgres-backed.

Still outside the accepted scope:

- invoice writes through Prisma
- payment session writes through Prisma
- matching writes through Prisma
- payment terminal transitions through Prisma
- webhook delivery writes through Prisma
- removing JSON fallback
- running Arc regressions without JSON payment runtime dependency

## Product meaning

After Day 6, Stablebooks has crossed the first real runtime migration boundary:
the web UI can read operator invoice data from Postgres through the API without
breaking the existing Arc payment flow.

That matters because future production hardening can now proceed endpoint by
endpoint instead of through a risky full-storage rewrite.

## Next recommended day

Recommended Day 7 theme:

- move invoice/payment writes toward Prisma incrementally
- start with invoice creation or payment session creation, not terminal payment
  transitions
- keep `json` fallback available
- keep Arc finalized/failed regressions green after every write-path slice
