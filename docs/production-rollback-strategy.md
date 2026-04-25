# Stablebooks Production Rollback Strategy

## Document status

- Date: `2026-04-22`
- Scope: `Day 15 Slice 5`
- Status: `draft`

## Purpose

This document describes how to safely roll back a production-like Stablebooks
cutover without losing payment evidence or creating duplicate settlement state.

Rollback should be treated as a controlled feature-flag change, not as a data
deletion exercise.

## Core principle

Do not delete or rewrite payment evidence during rollback.

Preserve:

- `raw_chain_events`
- `chain_payment_observations`
- `payments`
- `payment_events`
- `webhook_deliveries`

If something was ingested, keep the audit trail and pause new ingestion or
delivery instead of mutating history.

## Rollback levels

### Level 1: Pause new Arc provider ingestion

Use when inbound provider payloads are malformed, noisy, duplicated, or coming
from an unexpected source.

Change:

```env
ARC_SOURCE_ENABLED=false
```

Expected effect:

- `POST /api/v1/arc/webhooks/events` rejects production Arc callbacks.
- `POST /api/v1/arc/webhooks/finality` rejects production Arc callbacks.
- Existing payments/evidence remain readable.
- Operator UI remains available.

Do not change:

- Postgres storage flags
- existing payment records
- existing raw evidence

### Level 2: Disable outbound merchant webhooks

Use when merchant endpoint delivery is failing, misconfigured, or should be
paused while keeping payment ingestion active.

Change:

```env
STABLEBOOKS_WEBHOOK_URL=
```

Expected effect:

- terminal payment transitions still create webhook delivery records
- delivery records are marked `disabled`
- retry/replay can be used later after destination config is restored

Do not change:

- payment finality
- provider ingestion
- webhook delivery history

### Level 3: Stop new Postgres writes for a specific slice

Use only if a specific write path is suspected to be faulty.

Possible controls:

```env
STABLEBOOKS_INVOICE_WRITE_MODE=
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=
STABLEBOOKS_MATCHING_WRITE_MODE=
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=
STABLEBOOKS_WEBHOOK_WRITE_MODE=
```

Expected effect:

- the affected service falls back to the current non-Postgres behavior for that
  slice where code still supports fallback
- `/api/v1/health/storage` reports `postgresBackedRuntimeReady=false`

Important:

- partial rollback can create split-brain operator confusion
- prefer Level 1 or Level 2 first if the issue is provider/webhook specific
- document which flag changed and why

### Level 4: Read fallback

Use only for local/dev recovery or if Postgres reads are unavailable and the
team explicitly accepts stale JSON fallback behavior.

Change:

```env
STABLEBOOKS_STORAGE_MODE=json
```

Expected effect:

- operator reads come from JSON fallback
- `/api/v1/health/storage` reports `jsonStoreActive=true`
- Postgres-backed runtime is no longer cutover-ready

Warning:

- this can hide Postgres data created during cutover
- do not use as a casual production rollback unless the incident requires it

## Recommended incident sequence

1. Capture current `/api/v1/health/storage` output.
2. Capture current `/api/v1/arc/dev/readiness` output if dev endpoint is
   available in the environment.
3. Identify the failing area:
   - provider ingestion
   - matching/finality
   - outbound webhook delivery
   - UI/read path
4. Apply the smallest rollback level.
5. Restart/redeploy the affected service with changed env.
6. Re-check `/api/v1/health/storage`.
7. Confirm operator UI can still open invoice/payment detail.
8. Record changed flags in the incident log.

## What not to do

Do not:

- delete raw chain events
- delete chain payment observations
- delete webhook delivery records
- manually change finalized payments back to processing
- reuse `ARC_WEBHOOK_SECRET` as `STABLEBOOKS_WEBHOOK_SECRET`
- rotate secrets by committing `.env` files
- enable polling modes without checkpoint support

## Recovery after rollback

When ready to resume:

1. Restore the intended Postgres-backed flags.
2. Confirm `/api/v1/health/storage` returns
   `postgresBackedRuntimeReady=true`.
3. Restore `ARC_SOURCE_ENABLED=true` only after provider payload shape is
   trusted again.
4. Restore `STABLEBOOKS_WEBHOOK_URL` only after merchant endpoint is healthy.
5. Run smoke dry-runs.
6. Run the production-like flow smoke if safe for the environment.
7. Review webhook delivery queue for disabled/failed/dead-lettered records.
8. Replay deliveries intentionally, not automatically.

## Feature flag target state

Healthy production-like target:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
```

Safe provider pause:

```env
ARC_SOURCE_ENABLED=false
```

Safe outbound webhook pause:

```env
STABLEBOOKS_WEBHOOK_URL=
```

## Acceptance rule

A rollback is considered safe when:

- no evidence was deleted
- health/readiness output matches the intended mode
- operator UI can inspect impacted invoices/payments
- webhook delivery queue accurately reflects paused/failed delivery state
- the team has a written record of which flags changed
