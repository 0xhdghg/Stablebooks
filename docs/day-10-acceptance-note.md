# Stablebooks Day 10 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Postgres terminal payment transition migration`
- Status: `accepted`

## Acceptance summary

Day 10 is accepted for the current MVP stage.

Stablebooks now has a controlled Postgres write path for terminal payment
transitions:

- `processing -> finalized`
- `processing -> failed`

The important product result is that a Postgres-backed invoice/payment can now
move from matched onchain evidence into a terminal business state without
falling back to the JSON runtime.

Webhook delivery writes intentionally remain out of scope.

## Accepted capabilities

- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres` routes terminal payment
  transitions through Prisma.
- JSON terminal transitions remain the default when the flag is absent.
- `WorkspaceReadRepository` now supports payment finalization through Prisma.
- `WorkspaceReadRepository` now supports payment failure through Prisma.
- Finalization can locate payment by:
  - payment id
  - payment or invoice public token
  - matched observation id
- Failure can locate payment by:
  - payment id
  - payment or invoice public token
  - matched observation id
- Optional organization scoping is supported for admin-owned terminal actions.
- Finalization:
  - rejects `failed -> finalized`
  - treats already-finalized payments as idempotent no-op reads
  - writes confirmation evidence
  - moves payment to `finalized`
  - moves invoice to `paid`
  - moves linked observation to `confirmed`
  - writes `payment_confirmation_received`
  - writes `payment_finalized`
- Failure:
  - rejects `finalized -> failed`
  - treats already-failed payments as idempotent no-op reads
  - writes failure evidence
  - moves payment to `failed`
  - keeps invoice non-paid
  - moves linked observation to `rejected`
  - writes `payment_failure_received`
  - writes `payment_failed`
- Postgres terminal routing is wired for:
  - `POST /api/v1/payments/:paymentId/finalize`
  - `POST /api/v1/payments/:paymentId/fail`
  - `POST /api/v1/payments/mock/chain-confirmation`
  - `POST /api/v1/payments/mock/chain-failure`
  - `POST /api/v1/payments/mock/observations/:observationId/confirm`
  - `POST /api/v1/payments/mock/observations/:observationId/fail`
  - `POST /api/v1/arc/webhooks/finality`

## Verified checks

The following checks passed locally:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`

## Verified smoke

With these flags enabled:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`

### Finalize smoke

The API successfully verified the path:

1. create Postgres invoice
2. create hosted payment session in Postgres
3. ingest mock raw chain event
4. exact-match payment to `processing`
5. trigger mock chain confirmation
6. move payment to `finalized`
7. move invoice to `paid`
8. persist settlementReference
9. persist confirmationSource
10. persist confirmationTxHash
11. persist confirmationBlockNumber
12. persist terminal timestamps
13. show `payment_confirmation_received` in invoice timeline
14. show `payment_finalized` in invoice timeline

### Failure smoke

The API successfully verified the path:

1. create Postgres invoice
2. create hosted payment session in Postgres
3. ingest mock raw chain event
4. exact-match payment to `processing`
5. trigger mock chain failure
6. move payment to `failed`
7. keep invoice non-paid
8. persist failureReason
9. persist confirmationSource
10. persist confirmationTxHash
11. persist confirmationBlockNumber
12. keep settlementReference null
13. keep finalizedAt null
14. persist failure timestamps
15. show `payment_failure_received` in invoice timeline
16. show `payment_failed` in invoice timeline

Temporary smoke records were removed after verification.

Seed data remained intact:

- one seed organization
- one seed invoice
- one seed pending payment
- no leftover smoke raw chain events
- no leftover smoke observations

## Current boundaries

Day 10 does not mean the full payment runtime is completely Postgres-backed.

Still outside the accepted scope:

- webhook delivery writes through Prisma
- webhook retry/replay migration to Prisma
- removing JSON fallback
- production Arc provider setup
- partial payment or overpayment accounting
- multi-payment invoice aggregation beyond the current MVP model

## Product meaning

After Day 10, Stablebooks has the full core payment lifecycle available through
Postgres behind explicit feature flags:

1. invoice creation
2. hosted payment-session creation
3. raw chain event ingestion
4. observation matching
5. `processing`
6. `finalized` or `failed`

This means the product can now represent an end-to-end stablecoin receivable
from invoice creation to terminal payment state in the database that will
eventually become production storage.

## Next recommended day

Recommended Day 11 theme:

- move webhook delivery writes through Prisma
- keep webhook retry/replay behavior compatible
- preserve JSON fallback
- verify finalized and failed webhook delivery creation through Postgres
- keep Arc finalized/failed regressions green after every slice
