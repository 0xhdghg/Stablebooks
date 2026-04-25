# Stablebooks Day 4 Execution Plan

## Document status

- Date: `2026-04-20`
- Scope: `Day 4 real Arc ingestion adapter`
- Status: `completed`

## Goal

Replace the current mock chain ingestion surface with one real Arc ingestion
entrypoint, while preserving the Day 3 payment lifecycle that already works.

## Day 4 scope

Day 4 is about connecting Stablebooks to a real Arc event source.

It should move the system from:

- manually posted mock chain events

to:

- real Arc-originated settlement observations entering the same payment pipeline

## What Day 4 should include

- one explicit Arc source strategy for local and production use
- one ingestion adapter dedicated to Arc event intake
- validation of the canonical onchain fields
- persistence of raw Arc events into the existing raw evidence layer
- normalization into the existing observation model
- invocation of the existing matching, confirmation, and webhook flow
- configuration points for Arc network settings and webhook security

## What Day 4 should not include

- multi-chain expansion
- broad reconciliation tooling
- partial payment support
- overpayment handling
- analytics or reporting dashboards
- UI redesign unrelated to real Arc ingestion

## Canonical Day 4 data contract

The real Arc adapter should supply, at minimum:

- `txHash`
- `blockNumber`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`
- `confirmedAt`

## Success criteria

Day 4 is complete when a local developer can connect one real Arc-shaped source
to Stablebooks and observe:

- a raw Arc event entering the backend without using `payments/mock/*`
- the event being persisted into the raw evidence layer
- the event being normalized into a payment observation
- the existing Day 3 matching flow being triggered
- the payment reaching `processing` and then `finalized` or `failed`
- the operator UI continuing to show the same settlement fields
- the webhook layer emitting the same terminal events from the real ingestion path

## Execution order

1. choose and document the Arc source strategy
2. define the inbound Arc event contract and validation rules
3. build the Arc ingestion adapter entrypoint
4. map Arc payloads into `rawChainEvents` and normalized observations
5. connect real ingestion to the existing matching flow
6. connect confirmation/finality from the Arc source
7. verify webhook emission from the non-mock path
8. run one local end-to-end smoke from Arc ingestion to UI visibility

## Proposed deliverables

- `docs/day-4-execution-plan.md`
- one Arc adapter module in `apps/api`
- environment variables for Arc source configuration
- one local runbook for real-ingestion smoke verification

## Suggested implementation slices

### Slice 1

Document the Arc source strategy and lock the inbound event contract.

Slice 1 progress:

- source strategy decided
- inbound event contract decided
- provider assumptions documented

### Slice 2

Implement the Arc adapter entrypoint and validation layer.

Slice 2 progress:

- `ArcModule` scaffolded in `apps/api`
- Arc runtime config surface added
- provider payload normalizer added
- internal Arc ingest method added
- dev-only Arc routes added and smoke-tested:
  - `GET /api/v1/arc/dev/readiness`
  - `POST /api/v1/arc/dev/ingest`

### Slice 3

Persist raw Arc events and normalize them into observations.

### Slice 4

Trigger matching and confirmation from the real ingestion path.

Slice 4 progress:

- production-shaped Arc webhook ingress added:
  - `POST /api/v1/arc/webhooks/events`
- production-shaped Arc finality webhook added:
  - `POST /api/v1/arc/webhooks/finality`
- webhook ingress now enforces:
  - `ARC_SOURCE_ENABLED=true`
  - `ARC_SOURCE_KIND=webhook`
  - matching `x-arc-webhook-secret`
- happy-path local smoke confirmed:
  - provider payload enters through the non-dev Arc route
  - raw event persists
  - observation is normalized and matched
  - seeded payment moves to `processing`
  - finality payload enters through the non-dev Arc route
  - matched payment reaches `finalized` without `payments/mock/*`
  - terminal webhook delivery is created from the Arc path

### Slice 5

Verify webhook delivery and operator UI visibility from the new path.

Slice 5 progress:

- fixed local `next start` auth runtime smoke blocker by normalizing `API_BASE_URL`
- protected operator layout is now explicitly request-time rendered:
  - `dynamic = "force-dynamic"`
  - `fetchCache = "force-no-store"`
- scripted smoke now reaches protected pages with a valid session:
  - `/payments/pay_seed_apr_2026`
  - `/invoices/inv_seed_apr_2026`
  - `/webhooks`
- operator UI confirms Arc path visibility:
  - `arc_ingestion`
  - `Chain source confirmed at`
  - `Stablebooks terminal confirmed at`
  - `payment.finalized`
  - disabled webhook delivery when no destination is configured
- failed-path smoke confirmed through production-shaped Arc finality:
  - Arc finality payload with `outcome=failed` moves matched payment to `failed`
  - linked invoice returns to `open`
  - normalized observation is marked `rejected`
  - `payment.failed` webhook delivery is created from the Arc path
  - operator UI shows failure reason, `arc_ingestion`, source confirmation fields,
    and disabled delivery when no destination is configured
