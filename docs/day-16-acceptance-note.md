# Stablebooks Day 16 Acceptance Note

## Document status

- Date: `2026-04-23`
- Scope: `Staging/local production-runtime rehearsal`
- Status: `completed`

## Goal

Day 16 turned the Day 15 dry-run posture into a real local production-runtime
rehearsal.

The goal was to run the product with Postgres-backed reads/writes, execute the
production flow smoke without `--dry-run`, and verify the resulting invoice,
payment, provider diagnostics, and webhook delivery in the operator UI.

## Accepted outcome

Stablebooks now has a proven local rehearsal path:

```text
local Postgres
-> Postgres-backed API flags
-> readiness gate
-> non-dry-run production smoke
-> provider webhook event
-> payment finalized
-> invoice paid
-> webhook delivery created
-> Web UI verifies the evidence
-> hosted customer page shows terminal paid state
```

## Completed

- Day 16 rehearsal runbook was created.
- Local Postgres workspace was verified.
- Prisma migrations were checked.
- Seed fixtures were applied and verified.
- API was started with all Postgres-backed write modes.
- Storage readiness reached `postgresBackedRuntimeReady=true`.
- Arc webhook readiness reached `ready=true`.
- Production flow smoke ran without `--dry-run`.
- Smoke-created invoice reached `paid`.
- Smoke-created payment reached `finalized`.
- Provider diagnostics showed `sourceProfileMatched=true`.
- Webhook delivery was created with expected `disabled` status because outbound
  webhook URL was intentionally empty.
- Web UI was started against the local API.
- Operator UI routes were verified.
- Hosted payment page was verified.
- Rehearsal results were documented.

## Key IDs

- Invoice: `inv_c858e770c99e6168`
- Public token: `pub_75edadec50cf2150c7f5f6a3`
- Payment: `pay_9ef0719acf0facca`
- Tx hash:
  `0x3fce23e8f8ad50a20b4361c46a94e0f88138b68dd5a1c4f6ecdf6a5e60beb2d5`

## Key files

- `docs/day-16-execution-plan.md`
- `docs/day-16-rehearsal-runbook.md`
- `docs/day-16-rehearsal-results.md`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/web/app/pay/[publicToken]/page.tsx`

## Verification

The following checks passed during Day 16:

```text
corepack pnpm --filter @stablebooks/api build
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
corepack pnpm --filter @stablebooks/web build
corepack pnpm --filter @stablebooks/web typecheck
```

The production flow smoke passed without `--dry-run`:

```text
corepack pnpm --filter @stablebooks/api smoke:production-flow
```

UI route checks passed:

- `/invoices/inv_c858e770c99e6168`
- `/payments/pay_9ef0719acf0facca`
- `/webhooks?queue=all`
- `/pay/pub_75edadec50cf2150c7f5f6a3`

## Issues Found And Fixed

Payment detail read path:

- Problem: `GET /payments/<paymentId>` returned `404` after a Postgres-backed
  smoke-created payment was finalized.
- Fix: payment detail/list reads now use Postgres when
  `STABLEBOOKS_STORAGE_MODE=postgres_reads`.

Hosted paid invoice action:

- Problem: paid hosted invoice still rendered `Simulate stablecoin payment`.
- Fix: hosted invoice page now renders terminal `Payment complete` state and
  hides the repeat payment action for settled invoices.

## Deferred

Deferred intentionally:

- hosted staging deployment
- real Circle/Arc webhook registration
- production secret management setup
- real outbound merchant webhook destination
- browser-automated UI smoke
- removing JSON fallback
- removing mock/dev endpoints
- full RPC/indexer polling worker

## Day 17 recommendation

Recommended Day 17 theme:

- browser smoke automation for the production-runtime rehearsal

Recommended slices:

- add a repeatable browser smoke script for Web UI routes
- start API/Web automatically for local smoke where practical
- verify signin, invoice detail, payment detail, webhook queue, and hosted paid
  page
- make smoke output capture route statuses and key UI assertions
- keep real secrets out of screenshots/logs
- use the automated browser smoke as the gate before hosted staging deployment
