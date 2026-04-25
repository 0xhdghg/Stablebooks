# Stablebooks Day 15 Execution Plan

## Document status

- Date: `2026-04-22`
- Scope: `Production storage cutover readiness and deployment smoke`
- Status: `completed`

## Goal

Day 15 prepares Stablebooks for a production-like runtime where the main
product flow runs through Postgres-backed paths instead of JSON fallback.

The goal is not to deploy real production or register live provider webhooks.
The goal is to make the environment contract, readiness checks, smoke flow, and
rollback posture explicit before any hosted/staging cutover.

## Day 15 slices

### Slice 1

Create production env checklist.

Tasks:

- document required production-like env vars
- separate secrets from safe config
- separate API, web, Arc, webhook, smoke, and test-only variables
- document Postgres-backed runtime flags
- link checklist from README

Expected result:

- `docs/production-env-checklist.md`

Slice 1 progress:

- production env checklist created:
  - `docs/production-env-checklist.md`
- checklist covers:
  - API runtime
  - Web runtime
  - Postgres-backed feature flags
  - Arc webhook-first provider config
  - outbound merchant webhook config
  - smoke script config
  - dev/test-only config
  - secrets/no-commit rules
- README links Day 15 plan and production env checklist

### Slice 2

Strengthen Postgres runtime readiness endpoint.

Target:

- `/api/v1/health/storage`

Expected fields:

- storage mode
- invoice write mode
- payment session write mode
- matching write mode
- terminal payment write mode
- webhook write mode
- Arc evidence mirror mode
- Postgres reachability
- migration summary

Slice 2 progress:

- `/api/v1/health/storage` now includes `runtimeWriteModes`
- reported write modes:
  - `invoiceWriteMode`
  - `paymentSessionWriteMode`
  - `matchingWriteMode`
  - `terminalPaymentWriteMode`
  - `webhookWriteMode`
- readiness now includes `postgresBackedRuntimeReady`
- `postgresBackedRuntimeReady=true` requires:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - all write modes set to `postgres`
- existing fields remain available:
  - `storageMode`
  - `arcEvidenceMirrorMode`
  - `jsonStoreActive`
  - `postgres`
- Arc regression asserts non-cutover runtime is not marked ready
- webhook regression asserts full Postgres-backed runtime is ready
- API typecheck remained green
- API regression suite remained green

### Slice 3

Add production-like end-to-end smoke script.

Flow:

- create invoice
- create hosted payment session
- send provider webhook event
- send finality event
- verify payment/invoice/webhook delivery

Requirement:

- HTTP API only
- no direct DB insert
- no committed real secrets

Slice 3 progress:

- production-like end-to-end smoke script added:
  - `apps/api/scripts/smoke-production-flow.js`
- package command added:
  - `corepack pnpm --filter @stablebooks/api smoke:production-flow`
- dry-run mode added:
  - `corepack pnpm --filter @stablebooks/api smoke:production-flow -- --dry-run`
- script uses HTTP API only:
  - `GET /health/storage`
  - `POST /invoices`
  - `POST /public/invoices/:publicToken/payment-session`
  - `POST /arc/webhooks/events`
  - `POST /arc/webhooks/finality`
  - `GET /invoices/:invoiceId`
  - `GET /payments/:paymentId`
  - `GET /payments/webhook-deliveries?queue=all`
- script verifies:
  - storage readiness is `postgresBackedRuntimeReady=true`
  - provider profile matched
  - payment match is exact
  - payment finalizes
  - invoice becomes paid
  - payment detail exposes provider diagnostics
  - `payment.finalized` webhook delivery exists
- production env checklist updated with smoke vars
- no real secrets are committed

### Slice 4

Document UI smoke against Postgres runtime.

Operator surfaces:

- invoice detail
- payment detail
- provider source card
- webhook delivery diagnostics

Slice 4 progress:

- Postgres UI smoke checklist created:
  - `docs/postgres-ui-smoke.md`
- checklist covers:
  - API readiness preconditions
  - API/web start commands
  - production-like smoke data creation
  - invoice detail checks
  - payment detail checks
  - provider source card checks
  - webhook queue checks
  - hosted invoice checks
  - failure signs
- production env checklist now links to the UI smoke doc
- smoke remains manual for Day 15; browser automation is deferred

### Slice 5

Document rollback strategy.

Rollback controls:

- disable Arc source
- switch write flags away from Postgres if needed
- disable outbound webhook URL
- preserve Postgres evidence

Slice 5 progress:

- production rollback strategy documented:
  - `docs/production-rollback-strategy.md`
- rollback levels defined:
  - pause new Arc provider ingestion
  - disable outbound merchant webhooks
  - stop new Postgres writes for a specific slice
  - read fallback
- no-delete principle documented for:
  - raw chain events
  - chain payment observations
  - payments
  - payment events
  - webhook deliveries
- recovery sequence documented
- production env checklist now links rollback strategy

### Slice 6

Secrets and no-leak audit.

Checks:

- docs contain placeholders only
- smoke scripts require env
- readiness endpoints expose booleans instead of secret values
- no real provider/webhook secrets committed

Slice 6 progress:

- secrets/no-leak audit note created:
  - `docs/day-15-secrets-no-leak-audit.md`
- checked source/docs areas:
  - `docs/`
  - `apps/api/scripts/`
  - `apps/api/src/`
  - `apps/web/`
- confirmed expected secret posture:
  - production docs use placeholders
  - smoke scripts require env-provided secrets
  - dry-run output reports presence booleans, not secret values
  - Arc readiness exposes `hasRpcUrl` and `hasWebhookSecret`, not raw values
- hardened Postgres storage readiness:
  - connection errors redact full `DATABASE_URL`
  - credential-bearing URL fragments are redacted before JSON response
- local `apps/api/.env` is documented as local-only and not a production secret
  source
- verification passed:
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`

### Slice 7

Full verification.

Required checks:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- `corepack pnpm --filter @stablebooks/web typecheck`
- smoke script dry-runs

Slice 7 progress:

- full verification passed:
  - `corepack pnpm --filter @stablebooks/api build`
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`
  - `corepack pnpm --filter @stablebooks/web typecheck`
- smoke dry-runs passed with local placeholder env:
  - `corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run`
  - `corepack pnpm --filter @stablebooks/api smoke:production-flow -- --dry-run`
- dry-run output confirmed secrets are represented as booleans only:
  - `hasWebhookSecret`
  - `hasArcWebhookSecret`
  - `hasOperatorToken`

### Slice 8

Close Day 15.

Expected result:

- `docs/day-15-acceptance-note.md`
- README updated
- Day 16 recommendation captured

Slice 8 progress:

- Day 15 acceptance note created:
  - `docs/day-15-acceptance-note.md`
- Day 16 recommendation captured:
  - staging/local production-runtime rehearsal
  - non-dry-run production flow smoke
  - operator UI verification against smoke-created data
- README updated with Day 15 acceptance and next build steps
