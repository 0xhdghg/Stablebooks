# Stablebooks Day 7 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `First incremental Postgres write-path migration`
- Status: `accepted`

## Acceptance summary

Day 7 is accepted for the current MVP stage.

Stablebooks now has its first controlled Postgres write path. Invoice creation
can write to Prisma/Postgres behind an explicit feature flag while the default
runtime still keeps JSON fallback available.

The important product result is that an operator-facing commercial workflow can
now cross the Postgres boundary end to end:

- create invoice
- read invoice list from Postgres
- open invoice detail from Postgres
- keep existing Arc finalized/failed regressions green

## Accepted capabilities

- `POST /api/v1/invoices` supports Postgres writes behind:
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- JSON invoice creation remains the default when the flag is absent.
- `WorkspaceReadRepository` now supports invoice creation through Prisma.
- Postgres invoice creation validates that the selected customer belongs to the
  authenticated organization.
- Postgres invoice creation preserves:
  - service-generated `id`
  - `publicToken`
  - `referenceCode`
  - `draft` and `open` invoice statuses
  - existing API/web DTO shape
- `GET /api/v1/invoices` reads from Postgres when:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `GET /api/v1/invoices/:invoiceId` also reads from Postgres in
  `postgres_reads` mode.

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
- `STABLEBOOKS_STORAGE_MODE=postgres_reads`

The API successfully:

- created an invoice through `POST /api/v1/invoices`
- returned the created invoice in `GET /api/v1/invoices`
- preserved JSON fallback creation when the write flag was disabled

Temporary smoke invoices were removed after verification.

### UI smoke

A temporary API was started on port `4100` and a temporary Next production
server was started on port `3100`.

The UI successfully:

- rendered `/invoices/new` for an authenticated operator
- loaded the seed customer into the invoice form
- rendered a Postgres-created invoice in `/invoices`
- rendered the same Postgres-created invoice in `/invoices/:invoiceId`

The smoke uncovered and fixed one important migration gap:

- invoice list reads were already Postgres-backed in `postgres_reads`
- invoice detail reads were still JSON-backed
- detail reads now route through Postgres when `postgres_reads` is enabled

Temporary servers, logs, HTML captures, and smoke invoices were cleaned up.

## Current boundaries

Day 7 does not mean the full write runtime is Postgres-backed.

Still outside the accepted scope:

- payment session creation through Prisma
- payment matching writes through Prisma
- terminal payment finalization/failure through Prisma
- webhook delivery writes through Prisma
- public hosted payment page reads from Postgres
- removing JSON fallback
- production Arc provider setup

## Product meaning

After Day 7, Stablebooks has proven the safe migration pattern we need for the
rest of the app:

1. add a narrow Prisma repository method
2. gate the write path behind an explicit flag
3. read the result through `postgres_reads`
4. smoke the operator UI
5. keep money-flow regressions green

That gives us a repeatable path for moving the rest of the runtime without a
dangerous big-bang storage rewrite.

## Next recommended day

Recommended Day 8 theme:

- move payment session creation through Prisma
- keep terminal payment transitions on JSON for now
- keep webhook delivery persistence unchanged
- verify hosted invoice flow after the payment session write path moves
- keep Arc finalized/failed regressions green after every slice
