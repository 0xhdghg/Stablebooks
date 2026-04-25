# Stablebooks Day 18 Staging Deployment Checklist

## Document status

- Date: `2026-04-25`
- Scope: `Day 18 Slice 5`
- Status: `draft`

## Purpose

This checklist is the operational sequence for the first hosted staging
deployment.

Use it as the source of truth for rollout order.

The goal is to avoid:

- deploying API before database is ready
- exposing Web against the wrong API
- enabling provider webhooks before readiness is green
- improvising operator bootstrap during rollout

## Success definition

The first hosted staging rollout is successful when all of these are true:

- managed Postgres is provisioned
- migrations are applied
- API starts with Postgres-backed flags
- Web points at the staging API
- API readiness is green
- operator/org/wallet/customer bootstrap is complete
- production flow smoke passes
- production UI smoke passes

## Phase 1: infrastructure ready

Before any app deploy:

- staging Web hosting target exists
- staging API hosting target exists
- managed staging Postgres exists
- public staging API hostname is known
- public staging Web hostname is known
- deployment secret storage is available

Required outputs from this phase:

- `staging-web` URL
- `staging-api` URL
- managed `DATABASE_URL`

## Phase 2: secrets and config ready

Load API secrets into hosted secret storage:

- `DATABASE_URL`
- `ARC_WEBHOOK_SECRET`
- `STABLEBOOKS_WEBHOOK_SECRET` only if outbound merchant webhook is enabled

Load API safe config:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- `ARC_SOURCE_ENABLED=true`
- `ARC_SOURCE_KIND=webhook`
- `ARC_CHAIN_ID=5042002`
- `ARC_EVENT_MONITOR_SOURCE=circle_contracts_api`
- `ARC_EVENT_CONTRACT_ADDRESS=<staging-contract-address>`
- `ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)`
- `ARC_EVENT_TOKEN_SYMBOL=USDC`
- `ARC_EVENT_TOKEN_DECIMALS=6`

Choose outbound webhook mode:

- if no receiver exists yet:
  - `STABLEBOOKS_WEBHOOK_URL=`
- if receiver exists:
  - `STABLEBOOKS_WEBHOOK_URL=<staging-merchant-webhook-url>`

Load Web config:

- `API_BASE_URL=https://<staging-api-host>/api/v1`

Checkpoint:

- no secret values committed to repo files
- Web has no database or webhook secrets

## Phase 3: database migration

Before API serves live staging traffic, apply migrations:

```powershell
corepack pnpm --filter @stablebooks/api exec prisma migrate deploy
```

Checklist:

- command exits successfully
- no pending migration error remains
- database matches committed migration history

Do not use for normal hosted staging rollout:

```powershell
corepack pnpm --filter @stablebooks/api db:migrate:dev
```

## Phase 4: API deployment

Deploy API with the staging env contract.

Checklist:

- API build succeeds
- API starts without crash loop
- public API origin is reachable over HTTPS

Then verify:

- `GET /api/v1/health/live`
- `GET /api/v1/health/storage`

Expected storage posture:

- `postgresBackedRuntimeReady=true`
- `jsonStoreActive=false`
- `storageMode=postgres_reads`
- all write modes = `postgres`

Do not continue to provider setup or smoke until storage readiness is green.

## Phase 5: Web deployment

Deploy Web after API base URL is final.

Checklist:

- Web build succeeds
- Web serves over HTTPS
- `/signin` loads
- Web is configured with the correct `API_BASE_URL`

Quick sanity check:

- open `/signin`
- confirm no obvious server error page

## Phase 6: operator bootstrap

Bootstrap data through API flows, not destructive seed.

Sequence:

1. `POST /api/v1/auth/signup`
2. `POST /api/v1/organizations`
3. `POST /api/v1/wallets`
4. `POST /api/v1/customers`
5. `POST /api/v1/auth/signin`

Capture:

- operator email
- operator password location in secret manager/password manager
- fresh bearer token
- organization id
- settlement wallet address
- smoke customer id

Checkpoint:

- operator onboarding is complete
- default settlement wallet exists
- smoke customer exists for invoice creation

## Phase 7: provider webhook readiness

Before registering the real provider webhook destination:

- confirm API public hostname is final
- confirm `ARC_WEBHOOK_SECRET` is loaded in the API environment
- confirm API readiness is green

Expected provider targets:

- `POST https://<staging-api-host>/api/v1/arc/webhooks/events`
- `POST https://<staging-api-host>/api/v1/arc/webhooks/finality`

If provider registration is not available yet:

- keep this step documented
- continue with internal smoke using the same public API endpoints if possible

## Phase 8: staging smoke

Run smoke in this order:

1. API readiness checks
2. `smoke:production-flow`
3. `smoke:production-ui`

Required smoke inputs:

- staging API base URL
- staging Web base URL
- fresh operator token
- smoke customer id
- staging settlement wallet
- Arc webhook secret
- provider source profile values

Checklist:

- `smoke:production-flow` returns `ok=true`
- invoice reaches `paid`
- payment reaches `finalized`
- webhook delivery record exists
- `smoke:production-ui` returns `ok=true`
- invoice/payment/webhook/hosted pay routes all pass

## Phase 9: manual sign-off

After automated smoke:

- open operator dashboard
- open smoke invoice detail
- open smoke payment detail
- open webhook queue
- open hosted pay page

Confirm:

- provider diagnostics are visible in operator routes
- source confirmation fields are visible
- hosted pay page does not expose operator-only diagnostics

## Phase 10: record rollout result

Write down:

- deploy date
- staging Web URL
- staging API URL
- migration result
- operator bootstrap status
- smoke result
- open issues
- whether provider webhook registration is complete or still pending

Recommended output doc:

- `docs/day-18-staging-rollout-note.md` or the Day 18 acceptance note

## Stop conditions

Pause rollout if any of these happen:

- migrations fail
- `/health/storage` is not green
- API starts in JSON-backed mode
- Web points to the wrong API
- operator bootstrap fails
- smoke flow fails before finalization
- UI smoke fails on key routes

If rollout is paused, use the rollback/failure playbook from the next Day 18
slice before making ad hoc changes.

## Output of this slice

Stablebooks now has a concrete step-by-step hosted staging deployment
checklist.

## Next step

Proceed to Day 18 Slice 6:

- define the staging smoke sequence as a dedicated runbook
