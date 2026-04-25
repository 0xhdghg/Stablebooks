# Stablebooks Day 5 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Postgres runtime hardening and Arc regression coverage`
- Status: `accepted`

## Acceptance summary

Day 5 is accepted for the current MVP stage.

Stablebooks now has a Postgres-aware backend foundation around the accepted Day
4 Arc payment flow. The full payment runtime is still intentionally using the
JSON store as the source of truth, but the database contract, Prisma client,
readiness checks, evidence repository, mirror mode, and regression tests are in
place.

This gives the project a safe bridge from local JSON persistence to real
Postgres-backed payment infrastructure without risking the working Arc flow.

## Accepted capabilities

- Prisma schema is aligned with Day 4 Arc confirmation semantics.
- Day 5 migration was added and applied locally:
  - `20260421_day_5_arc_runtime_contract`
- Local Postgres can be checked through:
  - `GET /api/v1/health/storage`
- Storage readiness exposes:
  - active storage mode
  - JSON fallback state
  - Postgres reachability
  - database and schema name
  - applied migration count
  - latest migration timestamp
  - Arc evidence mirror mode
- Shared `PrismaService` exists for API database access.
- `ArcEvidenceRepository` exists for the Arc evidence boundary:
  - `raw_chain_events`
  - `chain_payment_observations`
- Repository supports:
  - summary reads
  - primary idempotency lookup by `(chainId, txHash, logIndex)`
  - fallback lookup by `(chainId, txHash, toAddress, amountAtomic)`
  - transactional raw event + observation creation
- Arc evidence can be mirrored into Postgres behind:
  - `STABLEBOOKS_ARC_EVIDENCE_MIRROR=postgres_shadow`
- `postgres_shadow` keeps JSON as the active payment runtime while writing raw
  evidence into Postgres for verification.
- `postgres_strict` exists as a future fail-closed mode.
- API runtime now respects `PORT`, with `4000` as the default.
- API test command now runs Arc finalized and failed regressions:
  - `corepack pnpm --filter @stablebooks/api test`

## Verified checks

The following checks passed locally:

- Prisma schema validation
- Prisma Client generation
- migration status against local Postgres
- API build
- API typecheck
- API regression test command

## Verified regression paths

### Arc finalized path

The regression runner verifies:

- temporary invoice and payment session are created
- Arc webhook event enters through `POST /api/v1/arc/webhooks/events`
- event matches exactly
- payment moves to `processing`
- Postgres evidence mirror returns `created`
- Arc finality enters through `POST /api/v1/arc/webhooks/finality`
- payment moves to `finalized`
- invoice moves to `paid`
- `payment.finalized` webhook delivery is created
- webhook snapshot is `finalized / paid`

### Arc failed path

The regression runner verifies:

- temporary invoice and payment session are created
- Arc webhook event enters through `POST /api/v1/arc/webhooks/events`
- event matches exactly
- payment moves to `processing`
- Postgres evidence mirror returns `created`
- Arc finality enters with `outcome=failed`
- payment moves to `failed`
- invoice returns to `open`
- observation moves to `rejected`
- `payment.failed` webhook delivery is created
- webhook snapshot is `failed / open`

## Cleanup guarantees

The regression runner is designed to avoid polluting local development state:

- JSON store is backed up before tests
- JSON store is restored after tests
- temporary Postgres evidence rows are deleted after tests
- isolated test API port is used

## Current boundaries

Day 5 does not yet mean the full API runtime is Postgres-backed.

Still outside the accepted scope:

- replacing JSON store as the payment source of truth
- Prisma-backed repositories for invoices, payments, events, and webhooks
- UI smoke against a fully Postgres-backed runtime
- background reconciliation from Arc provider history
- production webhook signature verification beyond the MVP shared-secret shape
- partial payment and overpayment accounting

## Product meaning

After Day 5, Stablebooks has moved from "working local payment flow" toward a
production-shaped backend foundation.

The important improvement is safety: we can now keep the working Arc payment
flow intact while gradually moving the durable payment data into Postgres with
readiness checks, repository boundaries, and regression tests protecting the
main money paths.

## Next recommended day

Recommended Day 6 theme:

- move the payment runtime from JSON to Prisma incrementally
- start with invoice/payment read repositories
- then move matching writes
- then move webhook deliveries
- keep the existing Arc finalized/failed regressions green after every slice

Day 6 has started with read-path migration work. The first Postgres workspace
read repository now exists, while JSON remains the active payment runtime.
