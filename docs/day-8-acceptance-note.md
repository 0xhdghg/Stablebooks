# Stablebooks Day 8 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Postgres payment session write-path migration`
- Status: `accepted`

## Acceptance summary

Day 8 is accepted for the current MVP stage.

Stablebooks now has its second controlled Postgres write path. Hosted payment
session creation can write to Prisma/Postgres behind an explicit feature flag,
while terminal payment transitions and webhook delivery writes remain protected
on the existing JSON runtime.

The important product result is that the hosted customer payment flow can now
cross the Postgres boundary end to end:

- hosted invoice renders from Postgres
- customer starts payment session
- pending payment is stored in Postgres
- invoice moves to `processing`
- operator sees payment and timeline event in invoice detail

## Accepted capabilities

- `POST /api/v1/public/invoices/:publicToken/payment-session` supports Postgres
  writes behind:
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- JSON payment-session creation remains the default when the flag is absent.
- `WorkspaceReadRepository` now supports payment-session creation through
  Prisma.
- Postgres payment-session creation:
  - finds payable invoice by invoice `publicToken`
  - rejects missing or `draft` invoices as public-not-found
  - reuses an existing `pending` or `processing` payment
  - returns success redirect data for paid/finalized cases
  - creates a new `pending` payment when needed
  - creates a `payment_session_created` payment event
  - moves the invoice to `processing`
- Public invoice reads use Postgres in `postgres_reads` mode:
  - `GET /api/v1/public/invoices/:publicToken`
  - `GET /api/v1/public/invoices/:publicToken/status`
- The public payment poller now uses `NEXT_PUBLIC_API_BASE_URL` instead of a
  hardcoded `4000` API port.

## Verified checks

The following checks passed locally:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- `corepack pnpm --filter @stablebooks/web build`
- `corepack pnpm --filter @stablebooks/web typecheck`

## Verified smoke

### API smoke

With these flags enabled:

- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_STORAGE_MODE=postgres_reads`

The API successfully:

- created a Postgres invoice
- started a public payment session for that invoice
- returned `paymentId`, `pending` status, and processing redirect
- showed invoice status `processing` through invoice detail
- showed the created `pending` payment through invoice detail
- showed `payment_session_created` in the invoice timeline
- reused the same pending payment on repeated session calls
- preserved JSON fallback when the payment-session write flag was disabled

Temporary smoke records were removed after verification.

### UI smoke

A temporary API was started on port `4100` and a temporary Next production
server was started on port `3100`.

The UI successfully:

- rendered `/pay/:publicToken` for a Postgres-created invoice
- started a payment session and returned the expected processing redirect
- rendered `/pay/:publicToken/processing` with pending payment state
- rendered operator invoice detail with:
  - created payment id
  - `payment_session_created` timeline event

The smoke uncovered and fixed one important migration gap:

- public hosted invoice reads still used JSON-store
- public hosted invoice reads now use Postgres when `postgres_reads` is enabled

Temporary servers, logs, HTML captures, and smoke records were cleaned up.

## Current boundaries

Day 8 does not mean the full payment runtime is Postgres-backed.

Still outside the accepted scope:

- matching writes through Prisma
- terminal payment finalization through Prisma
- terminal payment failure through Prisma
- webhook delivery writes through Prisma
- removing JSON fallback
- production Arc provider setup
- partial payment or overpayment accounting

## Product meaning

After Day 8, Stablebooks can run the first customer-facing payment step on top
of Postgres:

1. operator creates invoice
2. customer opens hosted invoice
3. customer starts payment session
4. system records pending payment and business timeline event
5. operator sees the payment attempt immediately

This is a meaningful product boundary: Stablebooks now has a Postgres-backed
receivables loop up to the point where real chain matching should begin.

## Next recommended day

Recommended Day 9 theme:

- move matching writes through Prisma
- keep terminal finalization/failure on JSON until matching writes are proven
- keep webhook delivery writes unchanged
- verify raw chain event -> observation -> match -> processing path through
  Postgres
- keep Arc finalized/failed regressions green after every slice
