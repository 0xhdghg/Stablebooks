# Stablebooks Day 15 Acceptance Note

## Document status

- Date: `2026-04-22`
- Scope: `Production storage cutover readiness and deployment smoke`
- Status: `completed`

## Goal

Day 15 prepared Stablebooks for a production-like runtime where the core product
flow can run through Postgres-backed paths instead of JSON fallback.

The goal was not to deploy production or register live Arc/Circle webhooks. The
goal was to make the env contract, readiness posture, smoke flow, rollback
strategy, and no-leak rules explicit before a hosted/staging cutover.

## Accepted outcome

Stablebooks now has a documented production-like cutover shape:

```text
production-like env
-> Postgres-backed write flags
-> readiness gate
-> invoice creation
-> hosted payment session
-> provider webhook event
-> finality event
-> invoice/payment verification
-> webhook delivery verification
-> operator UI smoke
-> rollback plan
```

## Completed

- Production env checklist was created.
- Postgres-backed runtime readiness was strengthened.
- `/api/v1/health/storage` now reports all write modes.
- `/api/v1/health/storage` now exposes `postgresBackedRuntimeReady`.
- Postgres readiness errors redact `DATABASE_URL` and credential-like URL
  fragments before returning JSON.
- Production-like HTTP-only smoke script was added.
- Arc webhook smoke script remained available and documented.
- Manual Postgres UI smoke checklist was documented.
- Production rollback strategy was documented.
- Secrets/no-leak audit was completed.
- README was updated with Day 15 documents.
- Full verification passed.

## Key files

- `docs/day-15-execution-plan.md`
- `docs/production-env-checklist.md`
- `docs/postgres-ui-smoke.md`
- `docs/production-rollback-strategy.md`
- `docs/day-15-secrets-no-leak-audit.md`
- `apps/api/src/modules/storage/postgres-readiness.service.ts`
- `apps/api/scripts/smoke-production-flow.js`
- `apps/api/scripts/smoke-arc-webhook.js`

## Verification

The following checks passed:

```text
corepack pnpm --filter @stablebooks/api build
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
corepack pnpm --filter @stablebooks/web typecheck
```

Smoke dry-runs passed:

```text
corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run
corepack pnpm --filter @stablebooks/api smoke:production-flow -- --dry-run
```

## Readiness gate

`postgresBackedRuntimeReady=true` now requires:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

## Deferred

Deferred intentionally:

- real hosted/staging deployment
- real Circle/Arc webhook registration
- live provider secret management
- full non-dry-run smoke against a running hosted/staging stack
- browser-automated UI smoke
- removing JSON fallback
- removing mock/dev endpoints
- full RPC/indexer polling worker

## Day 16 recommendation

Recommended Day 16 theme:

- staging/local production-runtime rehearsal

Recommended slices:

- run API and Web against real local Postgres with all Postgres-backed flags
- execute `smoke:production-flow` without `--dry-run`
- verify operator UI with the data created by the smoke flow
- capture screenshots/manual QA notes for invoice, payment, webhook queue, and
  hosted payment pages
- document exact commands for repeatable cutover rehearsal
- decide whether the next step is hosted staging deployment or browser smoke
  automation
