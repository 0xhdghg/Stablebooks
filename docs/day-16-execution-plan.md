# Stablebooks Day 16 Execution Plan

## Document status

- Date: `2026-04-22`
- Scope: `Staging/local production-runtime rehearsal`
- Status: `completed`

## Goal

Day 16 turns the Day 15 dry-run posture into a real local/staging-like
rehearsal.

The goal is to run the product with Postgres-backed reads/writes, execute the
production flow smoke without `--dry-run`, and verify the resulting invoice,
payment, provider diagnostics, and webhook delivery in the operator UI.

This is still not a real production launch. It is the rehearsal before hosted
staging or browser automation.

## Day 16 slices

### Slice 1

Prepare the rehearsal runbook.

Tasks:

- document exact PowerShell env setup
- document Postgres migration/seed preflight
- document API and Web start commands
- document readiness gates
- document non-dry-run smoke command
- document UI routes and values to capture
- document rollback/cleanup notes

Expected result:

- `docs/day-16-rehearsal-runbook.md`

Slice 1 progress:

- Day 16 rehearsal runbook created:
  - `docs/day-16-rehearsal-runbook.md`
- README links Day 16 plan and runbook

### Slice 2

Prepare local Postgres workspace.

Tasks:

- confirm local Postgres is reachable
- apply migrations
- run seed
- verify seed auth/customer/wallet prerequisites

Expected readiness:

- DB reachable
- migrations applied
- seed customer exists:
  - `cus_seed_acme`
- seed wallet exists:
  - `0x1111111111111111111111111111111111111111`
- smoke operator token exists:
  - `sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484`

Slice 2 progress:

- local Postgres connection verified through Prisma
- migrations checked:
  - `corepack pnpm --filter @stablebooks/api exec prisma migrate deploy`
  - result: no pending migrations
- seed applied:
  - `corepack pnpm --filter @stablebooks/api db:seed`
- seed prerequisites verified:
  - smoke session token exists
  - customer `cus_seed_acme` exists
  - settlement wallet `0x1111111111111111111111111111111111111111` exists
  - settlement wallet is default collection wallet
  - applied migration count: `3`

### Slice 3

Start Postgres-backed API.

Tasks:

- start API with all Postgres-backed runtime flags
- use webhook-first Arc source config
- keep outbound merchant webhook intentionally disabled unless testing delivery
  to a known endpoint

Expected readiness:

- `GET /api/v1/health/live` responds
- `GET /api/v1/health/storage` reports:
  - `postgresBackedRuntimeReady=true`
  - `jsonStoreActive=false`
  - all write modes are `postgres`

Slice 3 progress:

- Postgres-backed API started on local port `4000`
- process id:
  - `15116`
- logs:
  - `api-day16.out.log`
  - `api-day16.err.log`
- health check passed:
  - `GET /api/v1/health/live`
- storage readiness passed:
  - `postgresBackedRuntimeReady=true`
  - `jsonStoreActive=false`
  - `postgres.configured=true`
  - `postgres.reachable=true`
  - `postgres.databaseName=stablebooks`
  - `postgres.schemaName=public`
  - all runtime write modes are `postgres`
- Arc webhook readiness passed with local dev header:
  - `ready=true`
  - `sourceKind=webhook`
  - `hasWebhookSecret=true`
  - source profile provider `circle_event_monitor`
  - token `USDC` with `6` decimals

### Slice 4

Run production flow smoke without `--dry-run`.

Tasks:

- execute `smoke:production-flow`
- capture output:
  - `invoiceId`
  - `paymentId`
  - `invoiceStatus`
  - `paymentStatus`
  - `webhookDeliveryStatus`

Expected result:

- invoice is `paid`
- payment is `finalized`
- provider profile is matched
- webhook delivery record exists

Slice 4 progress:

- first non-dry-run smoke exposed a real rehearsal bug:
  - `GET /payments/<paymentId>` returned `404`
  - root cause: payment detail/list reads still used JSON storage while the
    smoke-created payment lived in Postgres
- bug fixed:
  - `PaymentsService.getById` now reads from Postgres when
    `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - `PaymentsService.listByInvoiceId` now reads from Postgres when
    `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - existing `WorkspaceReadRepository` Postgres payment read methods are now
    used by the API service layer
- verification after fix passed:
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`
- API was rebuilt and restarted:
  - process id `13888`
- seed was reset before final smoke rerun
- production flow smoke passed without `--dry-run`:
  - `corepack pnpm --filter @stablebooks/api smoke:production-flow`
- captured smoke output:
  - `invoiceId=inv_c858e770c99e6168`
  - `publicToken=pub_75edadec50cf2150c7f5f6a3`
  - `invoiceStatus=paid`
  - `paymentId=pay_9ef0719acf0facca`
  - `paymentStatus=finalized`
  - `matchResult=exact`
  - `providerDiagnostic.sourceProfileMatched=true`
  - `webhookDeliveryStatus=disabled`
- API detail verification passed:
  - invoice detail returns the smoke-created Postgres invoice and payment
  - payment detail returns provider diagnostics and onchain fields
  - webhook delivery queue returns one disabled `payment.finalized` delivery

### Slice 5

Start Web UI against the local API.

Tasks:

- start Web with `API_BASE_URL=http://127.0.0.1:4000/api/v1`
- sign in with seed operator
- confirm app shell loads

Expected result:

- operator UI reads the Postgres-backed data created by the smoke flow

Slice 5 progress:

- API prerequisite was restarted in Postgres-backed mode:
  - API URL `http://127.0.0.1:4000/api/v1`
  - process id `9072`
  - logs:
    - `api-day16.out.log`
    - `api-day16.err.log`
- Web production build passed:
  - `corepack pnpm --filter @stablebooks/web build`
- Web UI started against local API:
  - Web URL `http://127.0.0.1:3000`
  - process id `8348`
  - `API_BASE_URL=http://127.0.0.1:4000/api/v1`
  - logs:
    - `web-day16.out.log`
    - `web-day16.err.log`
- HTTP UI checks passed:
  - `/signin` returns `200`
  - `/dashboard` returns `200` with seed operator Bearer token
  - `/invoices/inv_c858e770c99e6168` returns `200` and includes smoke invoice
    state
  - `/payments/pay_9ef0719acf0facca` returns `200` and includes smoke payment
    state
- API and Web are left running for Slice 6 manual UI QA

### Slice 6

Manual UI QA.

Routes:

- `/invoices/<invoiceId>`
- `/payments/<paymentId>`
- `/webhooks`
- `/pay/<publicToken>`

Expected result:

- invoice detail shows paid/finalized state
- payment detail shows provider diagnostics and source confirmation fields
- webhook queue shows the delivery generated by finality
- hosted payment page is terminal/success-safe

Slice 6 progress:

- manual UI QA was run against the local production-runtime rehearsal stack:
  - API `http://127.0.0.1:4000/api/v1`
  - Web `http://127.0.0.1:3000`
  - Web process id `11332`
- invoice detail QA passed:
  - `/invoices/inv_c858e770c99e6168`
  - returns `200`
  - shows paid invoice state
  - shows finalized latest payment state
  - shows provider source card
  - shows smoke tx hash
  - shows webhook delivery state
- payment detail QA passed:
  - `/payments/pay_9ef0719acf0facca`
  - returns `200`
  - shows finalized payment state
  - shows provider source / Circle Event Monitor details
  - shows source confirmation fields
  - shows smoke tx hash
  - shows webhook delivery state
- webhook queue QA passed:
  - `/webhooks?queue=all`
  - returns `200`
  - shows `payment.finalized`
  - shows `disabled`
  - shows `No destination configured`
  - links to the smoke payment
- hosted payment QA found and fixed a customer-facing terminal-state issue:
  - paid hosted invoice still showed `Simulate stablecoin payment`
  - `/pay/[publicToken]` now renders a terminal `Payment complete` state for
    paid/finalized invoices
  - repeat payment action is hidden for settled invoices
- hosted payment QA passed after fix:
  - `/pay/pub_75edadec50cf2150c7f5f6a3`
  - returns `200`
  - shows paid / `Payment complete`
  - does not show `Simulate stablecoin payment`
  - does not expose operator diagnostics
- verification passed after hosted page fix:
  - `corepack pnpm --filter @stablebooks/web typecheck`
  - `corepack pnpm --filter @stablebooks/web build`

### Slice 7

Capture rehearsal results.

Tasks:

- document command outputs and captured IDs
- document any failure signs
- document manual UI verification result

Expected result:

- `docs/day-16-rehearsal-results.md`

Slice 7 progress:

- rehearsal results note created:
  - `docs/day-16-rehearsal-results.md`
- captured:
  - runtime ports and process ids
  - storage/provider posture
  - Postgres and readiness preflight
  - non-dry-run smoke command
  - smoke output IDs and statuses
  - onchain/provider fields
  - webhook delivery result
  - UI QA route checks
  - issues found and fixed
  - remaining work before hosted staging
- current local rehearsal services at capture time:
  - API `http://127.0.0.1:4000/api/v1`, process id `9072`
  - Web `http://127.0.0.1:3000`, process id `11332`

### Slice 8

Close Day 16.

Expected result:

- `docs/day-16-acceptance-note.md`
- next recommendation captured:
  - hosted staging deployment, or
  - browser smoke automation, or
  - production secrets/provider registration prep

Slice 8 progress:

- Day 16 acceptance note created:
  - `docs/day-16-acceptance-note.md`
- Day 16 execution plan marked `completed`
- README updated with Day 16 acceptance and Day 17 next steps
- Day 17 recommendation captured:
  - browser smoke automation for the production-runtime rehearsal
  - use browser smoke as the gate before hosted staging deployment
