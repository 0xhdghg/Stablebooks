# Stablebooks Day 5 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Postgres runtime hardening and Arc regression coverage`
- Status: `completed`

## Goal

Day 5 should make the accepted Day 4 payment flow durable against the real
Postgres/Prisma storage model.

The important outcome is not just "the API can connect to Postgres." The
important outcome is that the same Arc flow accepted on Day 4 can run against
database-backed storage contracts without losing idempotency, auditability, or
operator debuggability.

## Day 5 scope

Day 5 includes:

- Prisma schema alignment with the accepted Day 4 Arc/payment data contract
- migration updates for Arc confirmation and webhook delivery audit fields
- storage readiness endpoint for verifying Postgres connectivity before runtime
  migration
- API storage/runtime path preparation for Postgres-backed repositories
- seed path that creates the canonical dev organization, wallet, invoice, and
  payment attempt in Postgres
- regression coverage for finalized and failed Arc paths
- runbook updates for local Postgres, migration, seed, API/web, and smoke checks

Day 5 does not include:

- new product screens
- multi-chain support
- partial or overpayment accounting
- real Arc provider account setup
- production webhook signature scheme beyond the current shared-secret MVP
- analytics/reporting dashboards

## Acceptance criteria

Day 5 is complete when:

- Prisma schema contains every field required by the accepted Day 4 flow
- a fresh Postgres database can apply all migrations from scratch
- API exposes Postgres readiness while the JSON runtime fallback is still active
- seed creates one usable operator workspace in Postgres
- API build and typecheck pass
- finalized Arc regression passes:
  - Arc event is persisted
  - payment reaches `finalized`
  - invoice reaches `paid`
  - `payment.finalized` delivery is created
- failed Arc regression passes:
  - Arc event is persisted
  - payment reaches `failed`
  - invoice remains or returns to `open`
  - observation reaches `rejected`
  - `payment.failed` delivery is created
- operator UI can still display the same Arc settlement fields

## Implementation slices

### Slice 1

Align Prisma schema and migrations with the Day 4 Arc contract.

Required fields:

- payment confirmation identity:
  - `confirmationTxHash`
  - `confirmationBlockNumber`
  - `sourceConfirmedAt`
  - `confirmationReceivedAt`
- raw event source finality:
  - `sourceConfirmedAt`
- normalized observation source finality:
  - `sourceConfirmedAt`
- webhook delivery event audit:
  - `eventId`
  - `eventCreatedAt`
  - `paymentStatusSnapshot`
  - `invoiceStatusSnapshot`
  - `replayOfDeliveryId`

Slice 1 progress:

- Prisma schema now includes Day 4 Arc confirmation semantics:
  - payment confirmation identity
  - chain source confirmation timestamps
  - webhook event audit snapshots
- migration added:
  - `20260421_day_5_arc_runtime_contract`
- migration applied successfully to local Postgres
- Prisma schema validation passed
- Prisma Client generation passed
- API build passed
- API typecheck passed

### Slice 2

Add a Postgres storage readiness surface.

This should expose whether the API can reach the configured database without
switching the whole runtime at once.

Slice 2 progress:

- added `PostgresReadinessService`
- added storage readiness endpoint:
  - `GET /api/v1/health/storage`
- readiness response now exposes:
  - active storage mode
  - whether JSON store remains active
  - whether `DATABASE_URL` is configured
  - whether Postgres is reachable
  - database name
  - schema name
  - applied Prisma migration count
  - last applied migration timestamp
  - connection latency
  - connection error when degraded
- local API smoke passed:
  - `GET /api/v1/health/live`
  - `GET /api/v1/health/storage`
  - `GET /api/v1/arc/dev/readiness`

### Slice 3

Introduce Prisma-backed repositories for the payment domain.

Start with the tables that power Arc ingestion:

- `raw_chain_events`
- `chain_payment_observations`
- `payment_matches`
- `payments`
- `payment_events`
- `webhook_deliveries`

Slice 3 progress:

- added shared `PrismaService` for API database access
- refactored Postgres readiness to use the shared Prisma client
- added first Prisma-backed repository:
  - `ArcEvidenceRepository`
- repository currently covers the Arc evidence boundary:
  - `raw_chain_events`
  - `chain_payment_observations`
- repository supports:
  - evidence summary reads
  - primary idempotency lookup by `(chainId, txHash, logIndex)`
  - fallback lookup by `(chainId, txHash, toAddress, amountAtomic)`
  - transactional raw event + observation creation for the next ingestion slice
- added dev smoke endpoint:
  - `GET /api/v1/arc/dev/evidence-store`
- local API smoke confirmed the endpoint reads from Postgres while the main
  runtime still reports `storageMode=json`

### Slice 4

Move Arc finalized and failed flows onto the Postgres-backed repository path.

The JSON store can remain available as a local fallback while the Postgres path
is being proven.

Slice 4 progress:

- added feature-flagged Arc evidence mirror mode:
  - `STABLEBOOKS_ARC_EVIDENCE_MIRROR=postgres_shadow`
  - `STABLEBOOKS_ARC_EVIDENCE_MIRROR=postgres_strict`
- default mode remains disabled, so existing JSON-backed runtime behavior is
  unchanged unless the flag is explicitly set
- raw chain ingestion now returns `postgresMirror` metadata when mirror mode is
  enabled
- `postgres_shadow` mirrors raw event + normalized observation into Postgres but
  keeps JSON as the payment pipeline source of truth
- `postgres_strict` is reserved for later hardening and throws if the Postgres
  mirror write fails
- mirrored records preserve JSON evidence ids for easier cross-store debugging:
  - raw event id
  - observation id
- storage readiness now exposes:
  - `arcEvidenceMirrorMode`
- local smoke passed with mirror enabled:
  - temporary invoice/payment created in JSON
  - Arc webhook event entered the existing payment flow
  - payment matched exactly and moved to `processing`
  - Postgres mirror returned `status=created`
  - Postgres evidence summary showed one raw event and one observation
  - temporary JSON and Postgres smoke data were cleaned up after verification

### Slice 5

Add regression tests and a local Day 5 runbook.

The regression tests should cover the same finalized and failed paths accepted
at the end of Day 4.

Slice 5 progress:

- added self-contained Arc regression runner:
  - `apps/api/scripts/test-arc-regressions.js`
- API `test` script now runs:
  - API build
  - Arc finalized regression
  - Arc failed regression
- API runtime can now listen on `PORT`, with `4000` remaining the default
- regression runner starts API on an isolated test port
- regression runner enables:
  - `STABLEBOOKS_ARC_EVIDENCE_MIRROR=postgres_shadow`
  - `ARC_SOURCE_KIND=webhook`
  - `ARC_WEBHOOK_SECRET=replace-me`
- finalized regression verifies:
  - Arc event matches exactly
  - payment moves to `processing`
  - Postgres evidence mirror returns `created`
  - Arc finality moves payment to `finalized`
  - invoice moves to `paid`
  - `payment.finalized` webhook delivery is created
  - webhook snapshot is `finalized / paid`
- failed regression verifies:
  - Arc event matches exactly
  - payment moves to `processing`
  - Postgres evidence mirror returns `created`
  - Arc finality with `outcome=failed` moves payment to `failed`
  - invoice returns to `open`
  - observation moves to `rejected`
  - `payment.failed` webhook delivery is created
  - webhook snapshot is `failed / open`
- runner backs up and restores JSON store
- runner deletes temporary Postgres evidence rows after verification
- local command passed:
  - `corepack pnpm --filter @stablebooks/api test`
