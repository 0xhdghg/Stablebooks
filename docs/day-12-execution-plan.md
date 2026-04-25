# Stablebooks Day 12 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Production hardening before Arc provider setup`
- Status: `completed`

## Goal

Day 12 is a hardening day.

The goal is not to add a new product surface. The goal is to make the current
Postgres-backed payment runtime safer, easier to debug, and less fragile before
connecting it to production Arc infrastructure.

Day 12 should prove that Stablebooks can handle bad inputs, duplicate events,
webhook failures, retries, and replay flows without corrupting invoice/payment
state.

## Why hardening comes before production Arc

The current product already has the full MVP lifecycle behind feature flags:

1. invoice creation
2. hosted payment-session creation
3. raw chain event ingestion
4. observation matching
5. `processing`
6. `finalized` or `failed`
7. webhook delivery creation
8. retry/replay visibility

Before replacing mocks with production Arc infrastructure, the runtime needs a
stronger reliability boundary. Otherwise Arc integration work would mix provider
complexity with existing edge-case risk.

## Day 12 scope

Day 12 includes:

- duplicate webhook delivery protection
- idempotency checks for terminal payment events
- forced webhook failure smoke with a real failing endpoint
- dead-letter transition verification
- retry/replay regression coverage
- clearer operator-facing delivery diagnostics
- final Day 12 acceptance note

Day 12 does not include:

- production Arc RPC integration
- production Arc webhook endpoint setup
- removing JSON fallback
- partial payment or overpayment accounting
- merchant webhook endpoint management UI
- deployment setup

## Feature flags to preserve

Day 12 should keep the existing controlled runtime flags:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

JSON fallback remains the default when write flags are absent.

## Acceptance criteria

Day 12 is complete when:

- [x] duplicate terminal finality does not create duplicate webhook deliveries
- [x] duplicate raw chain ingestion remains idempotent
- [x] duplicate observation matching remains idempotent
- [x] retrying a delivery preserves payload and increments attempt state
- [x] replay creates a linked delivery and does not mutate the original delivery
- [x] a real failing webhook endpoint moves deliveries through retry states
- [x] dead-letter transition is verified with a forced failure path
- [x] operator delivery list exposes enough diagnostics to debug failed delivery
- [x] API build/typecheck/test remain green
- [x] temporary smoke records are cleaned after verification
- [x] Day 12 acceptance note is written

## Implementation slices

### Slice 1

Audit current idempotency boundaries.

Check and document:

- raw chain event dedupe
- observation matching dedupe
- terminal finalization/failure idempotency
- webhook delivery creation behavior after repeated terminal calls
- retry/replay mutation boundaries

Expected result:

- short code audit
- list of actual gaps, if any
- no behavioral changes unless a tiny safe fix is obvious

Slice 1 progress:

- idempotency audit documented in
  `docs/day-12-idempotency-audit.md`
- raw chain ingestion reviewed:
  - primary dedupe by `(chainId, txHash, logIndex)`
  - fallback dedupe by `(chainId, txHash, toAddress, amountAtomic)`
  - database uniqueness exists for `(chainId, txHash, logIndex)`
- observation matching reviewed:
  - `PaymentMatch.observationId` is unique
  - repeat matching updates the existing match
  - processing transition event only emits on first `pending -> processing`
- terminal state reviewed:
  - `failed -> finalized` is rejected
  - `finalized -> failed` is rejected
  - same-state terminal calls are treated as no-op inside the repository
- main hardening gap identified:
  - repeated terminal calls can still create duplicate canonical webhook
    deliveries because webhook dispatch only sees final payment status, not
    whether the terminal transition changed state
- Slice 2 target confirmed:
  - prevent duplicate canonical `payment.finalized` / `payment.failed`
    deliveries while keeping explicit replay behavior unchanged

### Slice 2

Harden duplicate terminal webhook delivery behavior.

Target:

- repeated `finalized` call should not spam duplicate `payment.finalized`
  deliveries
- repeated `failed` call should not spam duplicate `payment.failed` deliveries
- replay should remain the explicit way to create another delivery

Expected result:

- deterministic delivery creation guard
- JSON fallback preserved
- Postgres flag boundary preserved

Slice 2 progress:

- duplicate canonical webhook delivery behavior hardened
- Postgres terminal repository methods now expose whether terminal state
  actually changed
- Postgres webhook dispatch now runs only when a terminal transition changed
  state
- repeated `finalized` calls return the finalized payment without creating a
  second canonical `payment.finalized` delivery
- repeated `failed` calls return the failed payment without creating a second
  canonical `payment.failed` delivery
- explicit replay behavior remains unchanged and still creates a linked
  delivery through `replayOfDeliveryId`
- JSON fallback remains unchanged
- targeted HTTP smoke verified:
  - first finalized transition creates one delivery
  - second finalized call keeps one delivery
  - first failed transition creates one delivery
  - second failed call keeps one delivery
  - replay creates a linked delivery
- API regression test remained green

### Slice 3

Add forced failing webhook endpoint smoke.

Target:

- run the API against a local endpoint that returns non-2xx or drops requests
- verify delivery status, response fields, error fields, and attempt counters
- verify backoff fields are populated

Expected result:

- smoke path proves failure handling against an actual HTTP failure
- temporary data cleanup remains intact

Slice 3 progress:

- forced failing webhook endpoint smoke completed
- smoke used a local HTTP endpoint that consistently returned:
  - HTTP `500`
  - response body `forced failure from Day 12 Slice 3`
- smoke ran the Postgres-backed finalized payment path with:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
  - `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
  - `STABLEBOOKS_WEBHOOK_URL` pointed at the failing local endpoint
- verified persisted delivery state:
  - status `failed`
  - destination persisted
  - signature persisted
  - `attemptCount = 1`
  - `responseStatus = 500`
  - response body persisted
  - error message persisted
  - `lastAttemptAt` persisted
  - `nextAttemptAt` populated for retry backoff
  - `deliveredAt = null`
  - `deadLetteredAt = null`
  - `isTerminal = false`
- verified outbound request headers:
  - `X-Stablebooks-Event-Type`
  - `X-Stablebooks-Delivery-Id`
- temporary smoke records were cleaned
- API build and typecheck remained green

### Slice 4

Verify dead-letter transition.

Target:

- force enough failed attempts to reach `maxAttempts`
- verify `deadLetteredAt`
- verify dead-letter queue filter
- verify operator list meta counters

Expected result:

- dead-letter behavior is proven, not only structurally present

Slice 4 progress:

- forced dead-letter smoke completed
- smoke used a local HTTP endpoint that consistently returned HTTP `500`
- smoke configured:
  - `STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS=2`
  - `STABLEBOOKS_WEBHOOK_RETRY_BASE_MS=500`
- first delivery attempt verified:
  - status `failed`
  - `attemptCount = 1`
  - `nextAttemptAt` populated
  - `deadLetteredAt = null`
  - `isTerminal = false`
- retry attempt verified:
  - same delivery was updated
  - status moved to `dead_letter`
  - `attemptCount = 2`
  - `responseStatus = 500`
  - `deadLetteredAt` populated
  - `nextAttemptAt = null`
  - `isTerminal = true`
- endpoint received exactly two requests:
  - initial delivery attempt
  - manual retry attempt
- operator queue behavior verified:
  - all queue sees the dead-letter delivery
  - dead-letter queue includes the delivery
  - active queue excludes the dead-letter delivery
  - meta counters include the dead-letter record
- temporary smoke records were cleaned
- API build and typecheck remained green

### Slice 5

Tighten retry/replay regressions.

Target:

- retry preserves payload
- retry increments attempt state
- replay creates a new delivery
- replay links through `replayOfDeliveryId`
- replay does not mutate the original delivery

Expected result:

- regression coverage for the highest-risk webhook operator actions

Slice 5 progress:

- permanent webhook retry/replay regression script added:
  - `apps/api/scripts/test-webhook-regressions.js`
- API test command now runs:
  - Arc finalized/failed regressions
  - Postgres webhook retry/replay regressions
- regression runs the Postgres-backed payment lifecycle with:
  - `STABLEBOOKS_STORAGE_MODE=postgres_reads`
  - `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
  - `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
  - `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
  - `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
  - `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`
- verified retry behavior:
  - retry updates the same delivery
  - retry increments `attemptCount`
  - retry preserves payload
- verified replay behavior:
  - replay creates a new delivery
  - replay links through `replayOfDeliveryId`
  - replay preserves `eventId`
  - replay preserves `eventCreatedAt`
  - replay preserves payload
  - replay does not mutate the original delivery
- duplicate terminal guard is covered in the same regression:
  - repeated terminal confirmation does not create another canonical delivery
- temporary regression records are cleaned after the run
- full API test suite remained green

### Slice 6

Improve operator-facing diagnostics if needed.

Target:

- make failed/disabled/dead-letter deliveries easier to understand in the API
  response and existing UI
- prefer existing fields before adding new ones
- avoid UI redesign

Expected result:

- operator can tell why delivery is not delivered:
  - disabled
  - failed response
  - next retry scheduled
  - dead-lettered

Slice 6 progress:

- operator-facing webhook diagnostics added to API delivery responses
- diagnostics are available on:
  - Postgres webhook delivery list
  - JSON fallback webhook delivery list
  - nested payment webhook delivery records
  - nested invoice/payment detail delivery records
- diagnostic response shape includes:
  - severity
  - label
  - detail
  - nextAction
- covered states:
  - delivered
  - disabled
  - failed with retry scheduled
  - dead-letter
- existing UI now renders diagnostics on:
  - `/webhooks`
  - invoice detail latest webhook card
  - payment detail latest webhook card
- webhook queue table now also surfaces:
  - HTTP response status
  - error message
  - diagnostic explanation
  - suggested next action
- webhook regression now asserts disabled delivery diagnostics so the contract is
  not accidentally removed
- API tests remained green
- web typecheck remained green
- web production build remained green

### Slice 7

Run full Day 12 verification.

Required checks:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`

Expected result:

- API checks green
- Arc finalized/failed regressions green
- smoke records cleaned
- seed data intact

Slice 7 progress:

- full Day 12 verification completed
- API checks passed:
  - `corepack pnpm --filter @stablebooks/api build`
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`
- API regression suite includes:
  - Arc finalized/failed regressions
  - Postgres webhook retry/replay regressions
- web checks passed:
  - `corepack pnpm --filter @stablebooks/web typecheck`
  - `corepack pnpm --filter @stablebooks/web build`
- web production build compiled all current app routes successfully
- temporary smoke/regression records were cleaned by the verification scripts

### Slice 8

Close Day 12.

Expected result:

- `docs/day-12-acceptance-note.md`
- this plan marked `completed`
- README updated with Day 12 acceptance
- next day recommendation captured

Slice 8 progress:

- Day 12 acceptance note added
- execution plan marked completed
- acceptance checklist closed
- README updated with Day 12 acceptance
- next recommended target captured:
  - Day 13 production Arc provider setup plan
  - real Arc RPC/finality ingestion boundary
  - environment variable contract for Arc credentials and endpoints

## Recommended next day after Day 12

If Day 12 is clean, recommended Day 13 theme:

- production Arc provider setup plan
- real Arc RPC/finality ingestion boundary
- environment variable contract for Arc credentials and endpoints
- provider adapter interface if the current mock/provider split needs cleanup
