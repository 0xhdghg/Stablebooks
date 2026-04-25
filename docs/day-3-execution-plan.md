# Stablebooks Day 3 Execution Plan

## Document status

- Date: `2026-04-20`
- Scope: `Day 3 canonical payment backend flow`
- Status: `completed`

## Goal

Move Stablebooks from a prepared storage foundation to one real backend payment
flow that runs on top of Postgres and the new settlement data model.

## Day 3 scope

Day 3 is intentionally narrow.

It should implement one canonical settlement path end-to-end:

1. an operator publishes an invoice
2. a customer pays onchain
3. the backend ingests a chain event
4. the event is normalized into a chain payment observation
5. the observation is matched to the correct invoice payment attempt
6. the payment moves to `processing`
7. the payment moves to `finalized` or `failed`
8. Stablebooks emits a webhook
9. the operator sees the result in the UI

## What Day 3 should include

- one backend ingestion path for raw chain activity
- normalized observation persistence
- matching against invoice-bound payment attempts
- payment state transitions driven by settlement truth
- webhook emission from real payment outcomes
- local reproducibility of the same flow

## What Day 3 should not include

- multi-chain abstractions
- partial payment logic
- overpayment workflows
- reconciliation tooling
- extra status expansion beyond the current active runtime model
- UI redesign unrelated to settlement truth

## Success criteria

Day 3 is complete when a local developer can trigger one canonical payment
scenario without editing database rows manually and can observe:

- persisted raw chain evidence
- persisted normalized observation
- durable payment match result
- payment status transition
- webhook delivery creation
- operator-visible result in the existing UI

## Execution order

1. build raw event ingest path
2. normalize into observations with dedupe
3. connect matching
4. drive confirmation and payment transitions
5. emit webhooks from real outcomes
6. verify UI and smoke path

## Completion note

Day 3 was verified locally on `2026-04-20` through one canonical HTTP smoke:

1. seeded invoice `inv_seed_apr_2026` was used as the target receivable
2. a raw onchain payment event was posted to `/api/v1/payments/mock/raw-chain-event`
3. the normalized observation matched the pending payment exactly
4. the matched observation was confirmed through `/api/v1/payments/mock/observations/:id/confirm`
5. the payment moved to `finalized`, the invoice moved to `paid`, and a
   `payment.finalized` webhook delivery was created
6. operator pages `/invoices/:id`, `/payments/:id`, and `/webhooks` rendered the
   resulting state, including `txHash`, `rawChainEventId`, `logIndex`,
   `observedAt`, `confirmedAt`, and `confirmationSource = arc_ingestion`
