# Stablebooks Day 17 Execution Plan

## Document status

- Date: `2026-04-23`
- Scope: `Browser smoke automation for production-runtime rehearsal`
- Status: `completed`

## Goal

Day 17 turns the Day 16 manual UI QA into a repeatable smoke gate.

The goal is to verify the production-runtime rehearsal UI surfaces without
manual clicking:

```text
running Postgres-backed API
-> running Web UI
-> smoke-created invoice/payment/webhook data
-> automated route checks
-> machine-readable pass/fail output
```

The goal is not to build a full e2e test suite yet. The first version should be
small, local-friendly, and reliable enough to run before hosted staging.

## Success criteria

Day 17 is successful when:

- a repeatable Web smoke command exists
- smoke configuration comes from env vars
- smoke checks the Day 16 production-runtime routes
- smoke output reports route status and assertions
- smoke does not print real secrets
- docs explain how to run the smoke against local/staging Web
- README points to the Day 17 docs

## Target routes

Operator routes:

- `/signin`
- `/dashboard`
- `/invoices/<invoiceId>`
- `/payments/<paymentId>`
- `/webhooks?queue=all`

Public route:

- `/pay/<publicToken>`

## Required smoke env

```env
SMOKE_WEB_BASE_URL=http://127.0.0.1:3000
SMOKE_OPERATOR_TOKEN=<operator-session-token>
SMOKE_INVOICE_ID=<invoice-id>
SMOKE_PAYMENT_ID=<payment-id>
SMOKE_PUBLIC_TOKEN=<public-token>
```

Optional expected values:

```env
SMOKE_EXPECTED_TX_HASH=<tx-hash>
SMOKE_EXPECTED_WEBHOOK_STATUS=disabled
SMOKE_EXPECTED_INVOICE_STATUS=paid
SMOKE_EXPECTED_PAYMENT_STATUS=finalized
```

## Day 17 slices

### Slice 1

Create Day 17 execution plan.

Tasks:

- document goal and scope
- document target routes
- document required env
- document slices
- link plan from README

Expected result:

- `docs/day-17-execution-plan.md`

Slice 1 progress:

- Day 17 execution plan created:
  - `docs/day-17-execution-plan.md`
- README links Day 17 plan

### Slice 2

Choose the minimum browser smoke approach.

Tasks:

- inspect current dependencies and scripts
- decide between:
  - lightweight HTTP/SSR smoke script
  - Playwright browser automation
  - hybrid smoke now, browser automation later
- document the decision and tradeoff

Expected result:

- selected approach recorded in this plan

Default recommendation:

- start with a lightweight HTTP/SSR smoke script because it requires no new
  browser dependency and already catches SSR/API integration failures
- defer Playwright until visual/browser interaction coverage is needed

Slice 2 progress:

- current Web scripts inspected:
  - `dev`
  - `build`
  - `start`
  - `lint`
  - `typecheck`
  - `test`
- current Web dependencies inspected:
  - `next`
  - `react`
  - `react-dom`
  - TypeScript typings
- no Playwright/Puppeteer/e2e dependency is currently installed
- existing smoke scripts are API-side only:
  - `apps/api/scripts/smoke-arc-webhook.js`
  - `apps/api/scripts/smoke-production-flow.js`
- decision:
  - implement Day 17 as a lightweight HTTP/SSR smoke script in `apps/web/scripts`
  - use Node `fetch` against a running Next server
  - send `Authorization: Bearer <token>` for operator routes
  - assert SSR HTML contains expected UI evidence
  - assert public hosted page does not expose operator-only diagnostics
- tradeoff:
  - chosen approach does not validate real browser interactions or screenshots
  - chosen approach is dependency-free, fast, CI-friendly, and catches SSR/API
    integration regressions immediately
- Playwright remains deferred until we need click flows, screenshots, viewport
  checks, or cross-browser confidence

### Slice 3

Add Web smoke script.

Tasks:

- create `apps/web/scripts/smoke-production-ui.js`
- fetch target routes
- send `Authorization: Bearer <token>` for operator routes
- assert key text exists
- assert key text does not exist on public route
- output structured JSON summary

Expected checks:

- signin route returns `200`
- dashboard route returns `200`
- invoice detail includes paid/finalized/provider/tx evidence
- payment detail includes finalized/provider/source confirmation/tx evidence
- webhook queue includes finalized delivery and expected webhook status
- hosted page includes payment complete
- hosted page does not expose operator diagnostics
- hosted page does not show repeat payment action when settled

Slice 3 progress:

- Web smoke script created:
  - `apps/web/scripts/smoke-production-ui.js`
- script checks:
  - `/signin`
  - `/dashboard`
  - `/invoices/<invoiceId>`
  - `/payments/<paymentId>`
  - `/webhooks?queue=all`
  - `/pay/<publicToken>`
- script sends `Authorization: Bearer <token>` for operator routes
- script asserts required SSR HTML text is present
- script asserts forbidden public-page text is absent
- script outputs structured JSON summary
- script supports `--dry-run`
- dry-run passed with Day 16 captured IDs
- dry-run confirms operator token is represented as `hasOperatorToken`, not
  printed raw

### Slice 4

Make smoke configurable and safe.

Tasks:

- read all IDs/base URLs from env
- support optional expected tx hash and statuses
- avoid printing operator token
- fail with clear missing-env errors
- add dry-run if useful

Expected result:

- script is reusable for local and staging environments

Slice 4 progress:

- script reads required values from env:
  - `SMOKE_WEB_BASE_URL`
  - `SMOKE_OPERATOR_TOKEN`
  - `SMOKE_INVOICE_ID`
  - `SMOKE_PAYMENT_ID`
  - `SMOKE_PUBLIC_TOKEN`
- script supports optional expected values:
  - `SMOKE_EXPECTED_TX_HASH`
  - `SMOKE_EXPECTED_WEBHOOK_STATUS`
  - `SMOKE_EXPECTED_INVOICE_STATUS`
  - `SMOKE_EXPECTED_PAYMENT_STATUS`
- `SMOKE_EXPECTED_TX_HASH` is optional:
  - when provided, invoice/payment pages must include it
  - hosted public page must not include it
  - when omitted, status/diagnostic checks still run
- dry-run behavior verified:
  - prints route plan
  - prints `hasOperatorToken`
  - does not print raw operator token
- missing-env behavior verified:
  - exits non-zero with clear `Missing required env var: <name>` message
- script remains dependency-free and reusable for local/staging Web URLs

### Slice 5

Add package command.

Tasks:

- add Web package command:
  - `smoke:production-ui`
- document command in runbook/results docs

Expected command:

```text
corepack pnpm --filter @stablebooks/web smoke:production-ui
```

Slice 5 progress:

- Web package command added:
  - `smoke:production-ui`
- command maps to:
  - `node scripts/smoke-production-ui.js`
- dry-run verified through workspace command:
  - `corepack pnpm --filter @stablebooks/web smoke:production-ui -- --dry-run`
- dry-run output remains safe:
  - includes `hasOperatorToken`
  - does not print raw operator token

### Slice 6

Run smoke against current local rehearsal stack.

Use Day 16 captured IDs:

- invoice: `inv_c858e770c99e6168`
- payment: `pay_9ef0719acf0facca`
- public token: `pub_75edadec50cf2150c7f5f6a3`
- tx hash:
  `0x3fce23e8f8ad50a20b4361c46a94e0f88138b68dd5a1c4f6ecdf6a5e60beb2d5`

Expected result:

- smoke passes against `http://127.0.0.1:3000`

Slice 6 progress:

- confirmed local rehearsal stack was running:
  - Web `http://127.0.0.1:3000`, process id `11332`
  - API `http://127.0.0.1:4000/api/v1`, process id `9072`
- Web smoke executed:
  - `corepack pnpm --filter @stablebooks/web smoke:production-ui`
- output captured:
  - `day17-production-ui-smoke.out.log`
- smoke passed:
  - `ok=true`
- route checks passed:
  - `/signin` returned `200`
  - `/dashboard` returned `200`
  - `/invoices/inv_c858e770c99e6168` returned `200`
  - `/payments/pay_9ef0719acf0facca` returned `200`
  - `/webhooks?queue=all` returned `200`
  - `/pay/pub_75edadec50cf2150c7f5f6a3` returned `200`
- assertion coverage:
  - invoice detail: `6` include assertions
  - payment detail: `6` include assertions
  - webhook queue: `4` include assertions
  - hosted paid page: `2` include assertions and `5` exclude assertions
- hosted paid page confirmed:
  - no repeat payment action
  - no operator diagnostics / tx evidence leaked to public page

### Slice 7

Document browser smoke result.

Expected result:

- `docs/day-17-browser-smoke-results.md`

Capture:

- env shape
- route statuses
- assertion summary
- limitations
- next use before staging

Slice 7 progress:

- browser smoke result note created:
  - `docs/day-17-browser-smoke-results.md`
- captured:
  - chosen HTTP/SSR approach
  - command and script path
  - required env shape
  - optional expected values
  - secret safety posture
  - local runtime services
  - smoke output log
  - route status table
  - assertion summary
  - limitations
  - next use before hosted staging
- README updated with Day 17 browser smoke result link

### Slice 8

Close Day 17.

Expected result:

- `docs/day-17-acceptance-note.md`
- README updated
- Day 18 recommendation captured

Likely Day 18 recommendation:

- hosted staging deployment prep

Slice 8 progress:

- Day 17 acceptance note created:
  - `docs/day-17-acceptance-note.md`
- Day 17 execution plan marked `completed`
- README updated with Day 17 acceptance and Day 18 next steps
- Day 18 recommendation captured:
  - hosted staging deployment prep
  - staging architecture/config checklist
  - staging migration/seed/operator strategy
  - staging smoke sequence with API readiness, production flow smoke, and Web
    smoke
