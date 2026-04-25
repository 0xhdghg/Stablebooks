# Stablebooks Day 9 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Postgres matching write-path migration`
- Status: `completed`

## Goal

Day 9 moves the next payment-runtime write path toward Prisma/Postgres:

- raw chain event ingestion
- normalized chain observation storage
- observation-to-payment matching
- payment/invoice movement into `processing`

The goal is to support the path:

1. invoice exists in Postgres
2. payment session exists in Postgres
3. raw chain event is ingested
4. chain observation is stored
5. matching links observation to payment/invoice
6. payment remains non-terminal but moves to `processing`
7. operator sees observation, match, and timeline in UI/API reads

Day 9 intentionally stops before `finalized` and `failed`.

## Day 9 scope

Day 9 includes:

- Prisma write support for raw chain event ingestion
- Prisma write support for chain payment observations
- idempotency by `(chainId, txHash, logIndex)`
- fallback dedupe by `(chainId, txHash, to, amount)`
- Prisma write support for `payment_match`
- exact matching by wallet, token, amount, and open payment attempt
- linking observation to payment and invoice
- moving matched payment/invoice to `processing`
- writing business timeline events:
  - `payment_match_recorded`
  - `payment_processing_started`
- API smoke for mock raw chain event ingestion
- operator invoice/payment detail smoke through `postgres_reads`
- preserving JSON fallback
- preserving Arc finalized/failed regressions

Day 9 does not include:

- terminal payment finalization through Prisma
- terminal payment failure through Prisma
- webhook delivery writes through Prisma
- removing JSON-store
- production Arc provider setup
- partial payment or overpayment accounting

## Proposed feature flag

Add a narrow write flag:

- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`

Reason:

- matching can move independently from finalization
- terminal payment transitions stay protected on JSON
- Arc/mock ingestion can be smoked without moving the full payment runtime

## Target endpoints

Primary smoke target:

- `POST /api/v1/payments/mock/raw-chain-event`

Related endpoint:

- `POST /api/v1/payments/mock/observations/:observationId/match`

Arc-shaped paths to keep compatible:

- `POST /api/v1/arc/dev/ingest`
- `POST /api/v1/arc/dev/fixtures/:fixtureName/ingest`
- `POST /api/v1/arc/webhooks/events`

Terminal paths remain out of scope:

- `POST /api/v1/payments/:paymentId/finalize`
- `POST /api/v1/payments/:paymentId/fail`
- `POST /api/v1/payments/mock/chain-confirmation`
- `POST /api/v1/payments/mock/chain-failure`
- `POST /api/v1/payments/mock/observations/:observationId/confirm`
- `POST /api/v1/payments/mock/observations/:observationId/fail`

## Acceptance criteria

Day 9 is complete when:

- [x] Prisma method exists for raw chain event ingestion
- [x] Prisma method exists for stored observation matching
- [x] raw events dedupe by `(chainId, txHash, logIndex)`
- [x] fallback dedupe by `(chainId, txHash, to, amount)` is preserved
- [x] exact match creates or updates `payment_match`
- [x] exact match links observation to payment and invoice
- [x] exact match moves payment and invoice to `processing`
- [x] timeline includes `payment_match_recorded`
- [x] timeline includes `payment_processing_started` when status changes
- [x] created observation/match are visible through `postgres_reads`
- [x] JSON fallback remains default when the flag is absent
- [x] API build/typecheck/test remain green
- [x] web build/typecheck not required because Slice 5 did not touch UI code
- [x] Arc finalized/failed regressions remain green

## Safety rules

- Keep JSON fallback.
- Do not switch finalization to Prisma.
- Do not switch failure to Prisma.
- Do not switch webhook delivery persistence to Prisma.
- Do not remove existing seed data.
- Clean temporary smoke records after verification unless intentionally kept.
- Run API regressions after every write-path change.

## Implementation slices

### Slice 1

Create the Day 9 execution plan and choose the write target.

Chosen target:

- raw chain event ingestion plus observation matching through Prisma

Chosen feature flag:

- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`

Reason:

- invoice creation is already Postgres-backed behind a flag
- payment session creation is already Postgres-backed behind a flag
- matching is the next non-terminal payment-runtime write path
- matching can be verified without moving finalization/failure/webhooks

Slice 1 progress:

- Day 9 execution plan created
- target selected:
  - raw chain event -> observation -> match -> processing
- narrow write flag proposed:
  - `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- terminal payment transitions explicitly deferred
- webhook delivery writes explicitly deferred

### Slice 2

Add Prisma repository support for raw chain event and observation ingestion.

The repository should:

- normalize raw event fields
- validate amount, decimals, chainId, blockNumber, and addresses
- dedupe by `(chainId, txHash, logIndex)`
- preserve fallback dedupe by `(chainId, txHash, to, amount)`
- route event to known wallet when possible
- create `raw_chain_event`
- create `chain_payment_observation`
- return the same API response shape as the JSON path

Slice 2 progress:

- Postgres raw chain ingestion method added to `WorkspaceReadRepository`
- raw event fields are normalized and validated before write
- primary dedupe by `(chainId, txHash, logIndex)` is supported
- fallback dedupe by `(chainId, txHash, to, amount)` is supported
- settlement wallet routing is supported by chain/address
- new ingestions create:
  - `raw_chain_event`
  - `chain_payment_observation`
- deduped ingestions return existing raw event, observation, and existing match
  if one is already present
- matching and processing transitions are intentionally deferred to Slice 3 and
  Slice 4

### Slice 3

Add Prisma matching support.

The repository should:

- find candidate `pending` or `processing` payments
- support explicit matching by `paymentId` or `publicToken`
- support wallet-routed matching
- validate accepted token for invoice currency
- validate amount against invoice amount
- create or update `payment_match`
- link observation to payment and invoice on exact match

Slice 3 progress:

- Postgres stored-observation matching method added to `WorkspaceReadRepository`
- candidate discovery supports:
  - explicit `paymentId`
  - explicit payment public token
  - explicit invoice public token
  - wallet-routed pending/processing payments
- token validation mirrors the JSON rule:
  - invoice currency token is accepted
  - USD invoices also accept `USDC`
- amount validation compares atomic token amount to invoice minor units
- matching creates or updates `payment_match`
- exact matches link observation to payment and invoice
- non-exact matches keep observation non-terminal as `detected` or `rejected`
- processing transition and payment evidence copy remain deferred to Slice 4

### Slice 4

Add processing transition on exact match.

The repository should:

- copy chain evidence fields onto payment
- set payment `matchResult` and `matchReason`
- move payment to `processing` if it was `pending`
- keep invoice at `processing`
- write `payment_match_recorded`
- write `payment_processing_started` only when status changes
- stay non-terminal

Slice 4 progress:

- exact Postgres matches now copy chain evidence onto payment:
  - token
  - amountAtomic
  - normalizedAmount
  - decimals
  - chainId
  - txHash
  - logIndex
  - blockNumber
  - fromAddress
  - toAddress
  - sourceConfirmedAt
- exact matches set payment `matchResult` and `matchReason`
- exact matches link payment to the matched observation
- pending payments move to `processing`
- invoice moves to `processing` unless it is already `processing` or `paid`
- timeline now records `payment_match_recorded`
- timeline records `payment_processing_started` only on the first
  `pending -> processing` transition
- terminal finalized/failed paths remain untouched

### Slice 5

Run API and operator smoke.

Verify:

- create Postgres invoice
- start Postgres payment session
- ingest mock raw chain event
- confirm raw event, observation, match, and payment are linked
- confirm invoice detail shows observation/match/timeline through
  `postgres_reads`
- repeat raw event ingestion and verify dedupe
- verify JSON fallback still works when the flag is disabled

Slice 5 progress:

- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres` now routes mock/Arc raw
  ingestion and stored-observation matching through Prisma
- API smoke was run through real HTTP endpoints on a temporary local port:
  - `POST /api/v1/invoices`
  - `POST /api/v1/public/invoices/:publicToken/payment-session`
  - `POST /api/v1/payments/mock/raw-chain-event`
  - `GET /api/v1/invoices/:invoiceId`
- smoke verified:
  - Postgres invoice creation
  - Postgres hosted payment-session creation
  - raw event ingestion
  - observation creation
  - exact payment match
  - payment `processing`
  - invoice `processing`
  - copied `txHash`
  - visible `sourceConfirmedAt`
  - `payment_match_recorded` timeline event
  - `payment_processing_started` timeline event
  - repeated raw event dedupe
- temporary smoke records were cleaned after verification
- seed data remained intact after cleanup
- API regression test remained green

### Slice 6

Document Day 9 acceptance and next target.

Likely next target:

- terminal finalization/failure through Prisma

Decision rule:

- only start terminal transitions after matching smoke is stable
- keep webhook writes separate until terminal transitions are proven

Slice 6 progress:

- Day 9 acceptance criteria marked complete
- Day 9 status moved to `completed`
- separate acceptance note added:
  - `docs/day-9-acceptance-note.md`
- next target selected:
  - terminal `finalized` and `failed` payment transitions through Prisma
- next target boundary preserved:
  - webhook delivery writes remain separate until terminal transitions are
    stable
