# Stablebooks Day 9 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Postgres matching write-path migration`
- Status: `accepted`

## Acceptance summary

Day 9 is accepted for the current MVP stage.

Stablebooks now has a controlled Postgres write path for the first onchain
runtime boundary:

- raw chain event ingestion
- normalized chain observation creation
- observation-to-payment matching
- payment and invoice movement into `processing`

The important product result is that a customer payment can now be detected and
matched against a Postgres-backed invoice/payment attempt without using terminal
settlement yet.

## Accepted capabilities

- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres` routes mock/Arc raw ingestion and
  stored-observation matching through Prisma.
- JSON matching remains the default when the flag is absent.
- `WorkspaceReadRepository` now supports raw chain event ingestion through
  Prisma.
- Raw chain event ingestion:
  - validates required chain/payment fields
  - dedupes by `(chainId, txHash, logIndex)`
  - preserves fallback dedupe by `(chainId, txHash, to, amount)`
  - resolves the settlement wallet by chain/address
  - creates `raw_chain_event`
  - creates `chain_payment_observation`
- Stored observation matching:
  - supports explicit matching by payment id
  - supports explicit matching by payment or invoice public token
  - supports wallet-routed matching
  - validates token acceptance
  - validates atomic amount against invoice minor amount
  - creates or updates `payment_match`
  - links observation, payment, and invoice on exact match
  - copies chain evidence onto payment
  - moves pending payment to `processing`
  - moves invoice to `processing`
  - writes `payment_match_recorded`
  - writes `payment_processing_started` only on the first status transition

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

The API successfully verified the path:

1. create Postgres invoice
2. create hosted payment session in Postgres
3. ingest mock raw chain event
4. create raw event and observation
5. exact-match observation to payment
6. move payment to `processing`
7. move invoice to `processing`
8. expose `txHash` and `sourceConfirmedAt`
9. show `payment_match_recorded` in invoice timeline
10. show `payment_processing_started` in invoice timeline
11. repeat raw event ingestion and dedupe it

Temporary smoke records were removed after verification.

Seed data remained intact:

- one seed organization
- one seed invoice
- one seed pending payment
- no leftover smoke raw chain events
- no leftover smoke observations

## Current boundaries

Day 9 does not mean the full payment runtime is Postgres-backed.

Still outside the accepted scope:

- terminal payment finalization through Prisma
- terminal payment failure through Prisma
- webhook delivery writes through Prisma
- removing JSON fallback
- production Arc provider setup
- partial payment or overpayment accounting

## Product meaning

After Day 9, Stablebooks can represent the most important pre-settlement payment
state in Postgres:

1. invoice exists
2. payment session exists
3. customer pays onchain
4. chain event is ingested
5. payment is matched to the invoice
6. operator sees the payment as `processing`

This is the bridge between the commercial invoice flow and the chain evidence
flow. It is intentionally non-terminal: final settlement is the next safety
boundary.

## Next recommended day

Recommended Day 10 theme:

- move terminal `finalized` and `failed` payment transitions through Prisma
- keep webhook delivery writes separate until terminal transitions are proven
- preserve JSON fallback
- verify mock confirmation and mock failure endpoints through Postgres
- keep Arc finalized/failed regressions green after every slice
