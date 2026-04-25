# Stablebooks Day 11 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Postgres webhook delivery write-path migration`
- Status: `accepted`

## Acceptance summary

Day 11 is accepted for the current MVP stage.

Stablebooks now has a controlled Postgres write path for outbound webhook
delivery persistence:

- delivery creation
- first delivery attempt state
- retry attempt state
- replay delivery creation
- delivery list and queue counters

The important product result is that a Postgres-backed payment can now move from
terminal settlement state into merchant/operator notification state without
falling back to the JSON runtime.

## Accepted capabilities

- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres` routes webhook delivery writes
  through Prisma.
- JSON webhook behavior remains the default when the flag is absent.
- Finalized payments emit `payment.finalized` deliveries in Postgres.
- Failed payments emit `payment.failed` deliveries in Postgres.
- First delivery attempts are persisted through Prisma.
- Disabled delivery state is supported when no webhook URL is configured.
- Retry uses the existing delivery payload and increments persisted attempt
  state.
- Replay creates a new delivery linked by `replayOfDeliveryId`.
- Delivery list supports:
  - all deliveries
  - status filters
  - active queue
  - dead-letter queue
  - queue meta counters
- Webhook delivery timeline events are written through Prisma:
  - `webhook_delivery_succeeded`
  - `webhook_delivery_failed`
- Existing webhook payload shape is preserved.
- Existing webhook signing behavior is preserved.
- Existing retry/backoff behavior is preserved.

## Verified checks

The following checks passed locally during Day 11:

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
- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

The API successfully verified the finalized path:

1. create Postgres invoice
2. create hosted payment session in Postgres
3. ingest mock raw chain event
4. exact-match payment to `processing`
5. move payment to `finalized`
6. create `payment.finalized` delivery in Postgres
7. persist first delivery attempt
8. expose delivery through the operator list API

The API successfully verified the failed path:

1. create Postgres invoice
2. create hosted payment session in Postgres
3. ingest mock raw chain event
4. exact-match payment to `processing`
5. move payment to `failed`
6. create `payment.failed` delivery in Postgres
7. persist first delivery attempt
8. expose delivery through the operator list API

Retry and replay smoke verified:

1. existing Postgres delivery can be retried
2. retry increments `attemptCount`
3. retry uses the existing payload
4. replay creates a new delivery
5. replay links to the latest delivery through `replayOfDeliveryId`
6. replay preserves the event type

Operator queue smoke verified:

1. all-deliveries list includes Postgres deliveries
2. active queue includes disabled deliveries
3. dead-letter queue filter works
4. queue meta counters are returned from Postgres

Temporary smoke records were removed after verification.

Seed data remained intact.

## Current boundaries

Day 11 does not mean the full product is production-connected to Arc yet.

Still outside the accepted scope:

- production Arc provider setup
- real Arc RPC/webhook configuration
- removing JSON fallback
- merchant webhook endpoint management UI
- forced dead-letter transition smoke against a failing HTTP endpoint
- partial payment or overpayment accounting

## Product meaning

After Day 11, Stablebooks has the full MVP payment lifecycle available through
Postgres behind explicit feature flags:

1. invoice creation
2. hosted payment-session creation
3. raw chain event ingestion
4. observation matching
5. `processing`
6. `finalized` or `failed`
7. webhook delivery creation
8. retry/replay visibility for operators

This is the first point where the product shape looks like a real receivables
ops system instead of only a payment-state prototype.

## Next recommended day

Recommended Day 12 theme:

- run a production-hardening pass over the Postgres-backed runtime
- verify failure/retry edges with a real failing webhook endpoint
- tighten idempotency and duplicate-delivery tests
- decide whether the next large boundary is production Arc provider setup
