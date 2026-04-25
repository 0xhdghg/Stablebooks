# Stablebooks Day 18 Staging Failure Playbook

## Document status

- Date: `2026-04-25`
- Scope: `Day 18 Slice 7`
- Status: `draft`

## Purpose

This playbook defines how to react when the first hosted staging rollout does
not behave as expected.

The goal is to recover safely without deleting payment evidence, without hiding
the actual failure mode, and without introducing ad hoc fixes that make staging
harder to trust.

## Core rule

Do not delete evidence to make staging look clean.

Preserve:

- payments
- raw chain events
- chain payment observations
- payment events
- webhook deliveries

If something was ingested incorrectly, pause the failing part of the system.
Do not rewrite history as the first reaction.

## First response sequence

When staging fails, do this in order:

1. capture current failure symptom
2. capture `/api/v1/health/live`
3. capture `/api/v1/health/storage`
4. determine which layer is failing:
   - database/migrations
   - API startup/runtime
   - Web routing/rendering
   - provider webhook ingress
   - matching/finality
   - outbound webhook delivery
5. apply the smallest possible corrective action
6. re-run only the relevant verification step

## Failure category: migrations failed

Symptoms:

- `prisma migrate deploy` exits non-zero
- API cannot start against the staging database
- `/health/storage` shows Postgres not ready

Response:

1. stop rollout
2. do not deploy or expose Web as “healthy” yet
3. inspect migration error
4. confirm `DATABASE_URL` points to the intended staging database
5. confirm the DB is reachable from the API runtime
6. fix migration issue first
7. re-run `prisma migrate deploy`

Do not:

- switch to `db:migrate:dev` as a quick hosted fix
- start API against a half-migrated database

## Failure category: API starts in wrong runtime mode

Symptoms:

- `/health/storage` reports `jsonStoreActive=true`
- `postgresBackedRuntimeReady=false`
- one or more write modes are not `postgres`

Response:

1. stop smoke runs
2. inspect deployed env values
3. correct:
   - `STABLEBOOKS_STORAGE_MODE`
   - all write mode flags
4. redeploy/restart API
5. re-check `/health/storage`

This is a config failure, not a data deletion problem.

## Failure category: Web points to wrong API

Symptoms:

- `/signin` loads but operator routes fail
- pages show stale or unexpected data
- Web smoke fails while API readiness is green

Response:

1. inspect Web `API_BASE_URL`
2. verify it points to the intended staging API origin with `/api/v1`
3. redeploy Web if needed
4. re-run Web smoke only after API target is confirmed

Do not:

- assume API is broken before checking Web config

## Failure category: provider webhook rejected

Symptoms:

- `/arc/webhooks/events` returns auth/profile error
- provider smoke fails before payment reaches `processing`
- provider diagnostics show profile mismatch

Response:

1. confirm `ARC_SOURCE_ENABLED=true`
2. confirm `ARC_SOURCE_KIND=webhook`
3. confirm `ARC_WEBHOOK_SECRET` in API matches the sender secret
4. confirm provider source profile values:
   - `ARC_CHAIN_ID`
   - `ARC_EVENT_CONTRACT_ADDRESS`
   - `ARC_EVENT_SIGNATURE`
   - `ARC_EVENT_TOKEN_SYMBOL`
   - `ARC_EVENT_TOKEN_DECIMALS`
5. resend only the provider verification/smoke step

Safe pause option:

```env
ARC_SOURCE_ENABLED=false
```

Use this when inbound provider traffic is noisy or misconfigured and the rest of
the staging environment still needs to remain available.

## Failure category: payment does not match or finalize

Symptoms:

- provider event accepted but `matchResult` is not `exact`
- payment remains `pending` or `processing`
- invoice does not become `paid`

Response:

1. inspect the settlement wallet used in the smoke/bootstrap
2. confirm `SMOKE_SETTLEMENT_WALLET` matches the registered default settlement
   wallet
3. confirm token/chain/amount profile values
4. inspect payment detail and provider diagnostic
5. re-run API smoke with a fresh tx hash after fixing config/data mismatch

Do not:

- manually edit payment rows to force them forward
- manually change invoice status to hide the issue

## Failure category: outbound webhook delivery failing

Symptoms:

- payment finalizes but delivery is `failed` or `dead_letter`
- Webhook queue shows repeated delivery errors

Response:

1. inspect `STABLEBOOKS_WEBHOOK_URL`
2. confirm whether outbound delivery is intentionally enabled
3. if receiver is not ready, pause outbound delivery:

```env
STABLEBOOKS_WEBHOOK_URL=
```

4. redeploy API if env changed
5. verify that future terminal events create `disabled` deliveries instead of
   repeated failures

Important:

- this should not block validating the core invoice/payment flow
- keep delivery records for replay later

## Failure category: Web smoke failed but API smoke passed

Symptoms:

- `smoke:production-flow` succeeds
- `smoke:production-ui` fails on one or more routes

Response:

1. inspect the failing route from smoke output
2. verify Web can reach the API
3. verify operator token is valid
4. open the failing route manually
5. classify the issue:
   - wrong data source
   - SSR/API integration failure
   - missing rendered evidence
   - accidental operator diagnostic leak on public page

Then:

- fix Web config if it is env-related
- fix code if it is a real UI/runtime bug
- rerun only the Web smoke after correction

## Safe rollback levers

Use the smallest lever that matches the failure.

### Pause provider ingress

```env
ARC_SOURCE_ENABLED=false
```

Use when Arc/Circle webhook traffic is the unstable part.

### Pause outbound merchant delivery

```env
STABLEBOOKS_WEBHOOK_URL=
```

Use when merchant receiver is failing or not ready.

### Restore intended Postgres runtime flags

Correct these if the API came up in the wrong mode:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
```

### Avoid read fallback unless absolutely necessary

Do not casually use:

```env
STABLEBOOKS_STORAGE_MODE=json
```

Reason:

- it can hide the real Postgres-backed staging data
- it makes UI verification misleading

## What not to do

Do not:

- delete staging payment evidence to “reset faster”
- rerun destructive `db:seed` on shared staging
- reuse production wallet addresses
- commit secrets into repo files
- rotate into random env values without recording what changed

## Recovery verification

After any fix or rollback action, re-run only the necessary layer:

- if env/runtime changed:
  - `/health/storage`
- if provider config changed:
  - API smoke
- if Web config changed:
  - Web smoke
- if outbound webhook mode changed:
  - inspect webhook queue and rerun API smoke if needed

Once the failing layer passes, resume the remaining rollout steps.

## Escalation threshold

Pause the first hosted staging attempt completely if:

- migrations cannot be applied safely
- API cannot reach Postgres reliably
- provider ingress cannot be authenticated or validated
- core payment flow cannot reach `finalized`
- Web exposes operator diagnostics on hosted public pages

At that point, staging is not trustworthy enough to keep pushing forward.

## Relation to existing rollback strategy

This playbook is a Day 18 hosted-staging-specific operating guide.

For the broader production-like rollback model, see:

- `docs/production-rollback-strategy.md`

## Output of this slice

Stablebooks now has a first-hosted-staging failure and rollback playbook.

## Next step

Proceed to Day 18 Slice 8:

- close Day 18 with acceptance note and Day 19 recommendation
