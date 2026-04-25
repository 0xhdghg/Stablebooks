# Stablebooks Milestone 4 Execution Backlog

## Document status

- Version: `v0.1`
- Date: `2026-04-19`
- Product: `Stablebooks`
- Scope: `Milestone 4 execution backlog`
- Companion docs:
  - [arc_treasury_os_milestone_4_foundation.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_foundation.md)
  - [arc_treasury_os_backend_api_plan.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_backend_api_plan.md)
  - [arc_treasury_os_frontend_plan.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_frontend_plan.md)

## Goal

This document turns the Milestone 4 foundation into an execution-ready backlog
for the current monorepo.

It is optimized for:

- one solo builder,
- short vertical slices,
- low rewrite risk,
- fast movement from mocked settlement to production-shaped settlement.

## Current repo baseline

The backlog starts from the repo as it exists now, not from an idealized future
architecture.

- `apps/api/prisma/schema.prisma` is still extremely small and must be expanded
  before Milestone 4 can be implemented cleanly
- `apps/api/src/modules/payments` exists, but it is still a light module
  skeleton rather than a real settlement pipeline
- `apps/web` already has route-level pages for invoices, public payments, and
  webhook operations, but the feature layer is still thin

This means the first execution work should deepen the data model and service
contracts before building more UI polish.

## Execution principles

- build one canonical payment flow first
- prefer additive changes over refactors
- persist evidence before resolving business meaning
- expose operator truth only after backend truth exists
- keep internal contracts simple enough to test locally

## Delivery sequence

Milestone 4 should be delivered in this order:

1. expand persistence and enums
2. ingest and persist normalized Arc observations
3. match observations to invoice payment attempts
4. move payments through confirmation decisions
5. emit webhooks from real settlement outcomes
6. expose settlement truth in operator UI
7. add smoke and regression coverage

## Backlog

## Slice 1: Persistence foundation

### Objective

Create the minimum durable schema needed for real settlement truth.

### API tasks

- extend Prisma models for `Organization`, `Invoice`, `Wallet`, `Payment`, and
  `WebhookDelivery` where needed by Milestone 4
- add `ChainPaymentObservation` model with canonical onchain fields:
  `txHash`, `blockNumber`, `from`, `to`, `token`, `amount`, `decimals`,
  `chainId`, `confirmedAt`
- add `PaymentMatch` model with `matchResult` and `matchReason`
- add enums for payment status, match status, observation status, and invoice
  status transitions needed by the new flow
- generate and apply a migration
- seed one organization, one wallet, one customer, and one open invoice for
  local testing

### Deliverables

- updated [schema.prisma](/G:/bugbounty/Stablebooks/apps/api/prisma/schema.prisma)
- first Milestone 4 migration in `apps/api/prisma/migrations`
- seed data that supports one end-to-end payment path

### Acceptance criteria

- the API boots against a fresh database
- the database contains all required Milestone 4 tables
- a seeded invoice can be associated with a seeded payment attempt

## Slice 2: Observation ingest path

### Objective

Make the backend capable of receiving or simulating normalized Arc transfer
signals without yet finalizing settlement.

### API tasks

- create a repository or persistence service for `ChainPaymentObservation`
- add an internal ingest service in `apps/api/src/modules/payments`
- define one normalized internal method such as
  `ingestArcTransfer(rawEvent) -> ChainPaymentObservation`
- add idempotent deduplication by `chainId + txHash`
- keep a clear separation between raw ingestion input and normalized stored
  observation
- add one dev-only ingestion entrypoint so the canonical flow can be exercised
  locally before the real Arc adapter is finished

### Deliverables

- new payment ingestion service files inside
  `apps/api/src/modules/payments`
- internal DTO or mapper for observation normalization
- local dev path for creating observations in a deterministic way

### Acceptance criteria

- the same transfer payload cannot create duplicate observations
- a normalized observation is persisted with all minimum onchain fields
- ingestion can be executed locally without manual database edits

## Slice 3: Matching engine

### Objective

Resolve a normalized observation to exactly one invoice payment candidate or
classify it safely as non-exact.

### API tasks

- add `payment-matching.service.ts`
- route observations to an organization by settlement wallet and `chainId`
- filter candidate payments by invoice status and accepted token
- compare expected amount against observed `amount + decimals`
- create durable `PaymentMatch` records for `exact`, `unmatched`, `ambiguous`,
  and `rejected`
- update payment and invoice linkage only on `exact` matches

### Deliverables

- matching service in `apps/api/src/modules/payments`
- durable `PaymentMatch` persistence
- tests for exact, unmatched, ambiguous, and rejected outcomes

### Acceptance criteria

- one clean observation can be matched to one open invoice payment attempt
- invalid token or amount paths do not mutate invoice settlement state
- ambiguous candidates remain visible for later operator handling

## Slice 4: Confirmation and payment state machine

### Objective

Move payments from `pending` to `processing` to `finalized` or `failed` based
on settlement confirmation rules.

### API tasks

- add `payment-confirmation.service.ts`
- record `confirmedAt` when confirmation policy is satisfied
- transition payment status from `pending` to `processing` on accepted exact
  match
- transition payment status from `processing` to `finalized` or `failed`
- update invoice status from `open` to `processing` to `paid`
- preserve failure reason for rejected or invalidated linked payments

### Deliverables

- confirmation service and explicit state transition helpers
- invoice and payment status update logic in the payments module
- unit tests for allowed and forbidden transitions

### Acceptance criteria

- payment state transitions are explicit and validated
- invoice status mirrors the canonical Milestone 4 flow
- a finalized payment stores the canonical onchain fields on the operator-facing
  payment record

## Slice 5: Real webhook emission from settlement truth

### Objective

Make webhook deliveries originate from real settlement outcomes instead of mock
finalization alone.

### API tasks

- emit `payment.finalized` from real payment finalization
- emit `payment.failed` from real rejected or invalidated payment outcomes
- persist webhook deliveries linked to the payment and invoice context
- expose delivery replay and delivery status through the existing webhooks
  module
- ensure retry and dead-letter flows still work with the new event source

### Deliverables

- webhook event producer changes in `apps/api/src/modules/webhooks`
- payment-to-webhook integration from the payments module
- updated webhook payload mapping for settlement fields

### Acceptance criteria

- a real payment finalization creates webhook deliveries automatically
- a real payment failure creates webhook deliveries automatically
- retry and dead-letter behavior still works after the backend source changes

## Slice 6: Operator settlement UI

### Objective

Expose real settlement truth where operators already work.

### Web tasks

- update invoice detail page to show canonical onchain settlement fields
- add `ChainObservationCard` and `WebhookDeliverySummaryCard`
- update payment detail page to show settlement decision, onchain metadata, and
  linked webhook deliveries
- upgrade `/webhooks` into an operations page with deliveries table and
  dead-letter summary
- ensure hosted payment status surfaces still reflect `processing`,
  `finalized`, and `failed`

### Deliverables

- new or updated components in `apps/web`
- data loaders or client fetchers for payment and webhook detail surfaces
- UI copy that distinguishes settlement processing from settlement finality

### Acceptance criteria

- an operator can inspect `txHash`, `blockNumber`, `from`, `to`, `token`,
  `amount`, `decimals`, `chainId`, and `confirmedAt`
- an operator can see whether a payment is unmatched, processing, finalized, or
  failed
- an operator can see webhook delivery and dead-letter state without leaving the
  main app shell

## Slice 7: Smoke coverage and local operability

### Objective

Make the Milestone 4 path runnable end-to-end in local development.

### API tasks

- add integration tests for observation ingest, exact match, finalize, fail,
  and webhook emission
- add seed or fixture helpers for the canonical happy path
- document how to trigger the local payment observation flow

### Web tasks

- add UI smoke coverage for invoice detail and webhook operations
- verify that the app renders correctly after a real backend-driven payment
  transition

### Deliverables

- integration tests in `apps/api/test`
- smoke coverage or scripted checks for `apps/web`
- short local runbook in `docs/` or repo root

### Acceptance criteria

- a local developer can create an invoice, inject an observation, confirm it,
  and see the result in the UI
- the same developer can force a failed path and inspect the resulting webhook
  state

## Recommended implementation order by file system

### First API wave

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts` or existing seed entrypoint
- `apps/api/src/modules/payments/payments.module.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- new payment observation and matching service files
- `apps/api/src/modules/webhooks/webhooks.service.ts`

### Then web wave

- `apps/web/app/(app)/invoices/[invoiceId]/page.tsx`
- `apps/web/app/(app)/payments/[paymentId]/page.tsx`
- `apps/web/app/(app)/webhooks/page.tsx`
- `apps/web/features/...` settlement display components as they are introduced

## Dependency map

- Slice 1 blocks everything else
- Slice 2 depends on Slice 1
- Slice 3 depends on Slices 1 and 2
- Slice 4 depends on Slice 3
- Slice 5 depends on Slice 4
- Slice 6 depends on Slices 4 and 5
- Slice 7 depends on Slices 1 through 6

## What to defer

Do not pull these into the first Milestone 4 execution wave:

- multi-chain generalization
- partial payment automation
- overpayment workflows
- manual reconciliation UI
- treasury analytics expansion
- exports changes unrelated to settlement truth

## Definition of done

Milestone 4 is done when one canonical scenario works end-to-end:

1. an operator publishes an invoice
2. a customer payment creates a normalized Arc observation
3. Stablebooks matches that observation to the right payment attempt
4. the payment becomes `processing` and then `finalized` or `failed`
5. webhook deliveries are emitted from that real outcome
6. the operator can inspect all relevant settlement and webhook data in the UI
