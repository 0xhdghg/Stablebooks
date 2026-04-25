# Stablebooks Milestone 4 Foundation

## Document status

- Version: `v0.2`
- Date: `2026-04-19`
- Product: `Stablebooks`
- Scope: `Milestone 4 foundation`
- Companion docs:
  - [arc_treasury_os_day_1_payment_flow_note.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_day_1_payment_flow_note.md)
  - [arc_treasury_os_prd.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_prd.md)
  - [arc_treasury_os_backend_api_plan.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_backend_api_plan.md)
  - [arc_treasury_os_milestone_4_execution_backlog.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_execution_backlog.md)

## Why Milestone 4 exists

Milestone 4 moves Stablebooks from a strong mock-backed alpha core to a production-shaped alpha.

By the end of this milestone, the product should no longer depend on mock chain confirmation as the primary settlement source. Instead, Stablebooks should be ready to ingest real onchain payment signals, persist them in durable storage, resolve them into payment outcomes, and expose those outcomes through operator-facing finance workflows.

This milestone is important because the current product already proves the application shape:

- a finance team can create customers and invoices,
- a hosted invoice page can open a payment session,
- a payment can move through `pending`, `finalized`, and `failed`,
- outbound webhooks can be retried and dead-lettered,
- operators can inspect payment and webhook state in the UI.

What is still missing is the bridge between a demo-quality payment lifecycle and a real settlement lifecycle. Milestone 4 is that bridge.

## Current state of Stablebooks

Stablebooks already includes a usable alpha core across web and API.

### Product capabilities already implemented

- authentication with session-backed access,
- onboarding for organization and settlement wallet setup,
- customer creation and detail views,
- invoice creation, listing, and invoice detail views,
- hosted public invoice payment flow,
- payment state transitions with `pending`, `finalized`, and `failed`,
- outbound webhook delivery with retry and dead-letter queue behavior,
- operator visibility into payment status and webhook delivery status.

### Current payment lifecycle shape

Today, the canonical user flow looks like this:

1. An operator publishes an invoice.
2. A customer opens the hosted payment page.
3. Stablebooks creates a `payment` record in `pending`.
4. A mock chain endpoint or admin action moves the payment to `finalized` or `failed`.
5. Stablebooks emits a webhook.
6. The operator sees resulting payment and webhook state in the UI.

This means the domain model and UI are already in place, but the settlement trigger is still mocked.

### Current operator surfaces

The operator can already inspect payment operations through:

- invoice detail pages, which show payment state, settlement metadata, failure reason, timeline, and webhook delivery summary,
- webhook queue pages, which show retry state, dead-letter state, and manual retry actions.

### Current system limitation

The core limitation is that settlement truth does not yet come from a real Arc ingestion pipeline.

The system can already react to settlement outcomes, but it does not yet detect, normalize, and match live onchain transfers as the source of those outcomes.

## Target system shape

Milestone 4 should preserve the current product shape while replacing mock settlement triggers with a real payment ingestion and persistence layer.

### Target runtime components

By the end of the milestone, Stablebooks should operate as one production-shaped application stack with these parts:

- `web app` for operator workflows and hosted invoice experiences,
- `API monolith` as the main authenticated and public application surface,
- `persistent database` as the durable source of truth for invoices, payments, events, and webhook deliveries,
- `chain ingestion worker` that reads Arc payment activity and turns it into normalized observations,
- `payment resolution layer` that matches observations to invoices and decides whether a payment becomes `processing`, `finalized`, or `failed`,
- `webhook delivery subsystem` that emits downstream events and manages retries and dead-lettering,
- `operator surfaces` that expose payment state, settlement metadata, and webhook operations.

### Target payment truth model

The target system should follow one simple rule:

- Arc settlement signals become the source of truth for payment state changes.

This means Stablebooks should no longer rely on:

- admin-only manual finalization as the primary path,
- mock chain confirmation endpoints as the primary path,
- timer-like or UI-driven payment state transitions.

Those tools may still exist for local development and debugging, but they should no longer define the real operating model.

### Target separation of responsibilities

Milestone 4 should make the system boundaries explicit:

- the `web app` is responsible for visibility and operator control,
- the `API monolith` is responsible for product rules and state transitions,
- the `database` is responsible for durable business state,
- the `chain ingestion worker` is responsible for detecting and normalizing payment signals,
- the `webhook subsystem` is responsible for external delivery, retry, and dead-letter behavior.

This separation matters because the product already has UI and payment state semantics. What it lacks is a real settlement pipeline behind those semantics.

### Milestone 4 boundaries

Milestone 4 should include:

- real chain payment detection,
- durable persistence for payment and invoice operations,
- normalized payment observations,
- invoice and payment matching logic,
- settlement-driven payment outcomes,
- operator-facing payment and webhook operations views.

Milestone 4 should not try to include:

- multi-chain abstractions,
- partial payment support,
- refunds or disputes,
- advanced reconciliation edge cases,
- ERP-grade accounting depth.

The goal is not to solve every finance edge case. The goal is to make one real onchain invoice-to-settlement flow trustworthy enough for a production-shaped alpha.

## Canonical domain model

Milestone 4 should use a small, stable domain language so that product, backend, ingestion, and ops surfaces all describe the same objects in the same way.

### Invoice

An `Invoice` is the commercial receivable record.

It defines:

- who should pay,
- how much should be paid,
- in which billing currency,
- whether the invoice is payable yet,
- whether the receivable is still open or already settled.

For Milestone 4, the invoice remains the operator-facing commercial object. It is not the raw settlement object.

### Payment

A `Payment` is the settlement-tracking object created when a hosted payment flow begins.

It represents:

- one payment attempt against one invoice,
- the settlement lifecycle of that attempt,
- the operator-visible outcome of that attempt,
- the record that stores settlement metadata like transaction hash and block number.

For Milestone 4, a payment is the main state machine that moves between `pending`, `finalized`, and `failed`.

### Settlement wallet

A `Settlement wallet` is the onchain destination controlled by the organization and used to receive invoice-linked funds.

It defines:

- where the customer is expected to send payment,
- which wallet the ingestion system watches,
- which organization owns the incoming settlement destination.

For Milestone 4, this wallet is part of the routing and matching context, not just onboarding metadata.

### Chain payment observation

A `Chain payment observation` is a normalized internal record of an onchain transfer that may represent a customer payment.

It exists so Stablebooks can separate:

- raw detection from the chain,
- business interpretation,
- final payment resolution.

This object is the ingestion-facing input into payment matching.

### Payment match

A `Payment match` is the result of deciding whether a chain payment observation belongs to a known invoice and payment attempt.

It answers:

- which invoice this transfer belongs to,
- which payment record it should update,
- whether the observation is usable for settlement resolution.

For this milestone, the canonical flow assumes one clean match between one observation and one payment attempt.

### Settlement decision

A `Settlement decision` is the internal conclusion Stablebooks reaches after evaluating a matched chain payment observation.

It determines whether the payment should move to:

- `processing`,
- `finalized`,
- or `failed`.

This object represents business interpretation of settlement truth, not the raw chain event itself.

### Webhook delivery

A `Webhook delivery` is the outbound notification record emitted after a meaningful payment outcome.

It is responsible for:

- recording what Stablebooks attempted to send,
- tracking retry state,
- surfacing dead-letter behavior,
- giving operators visibility into external delivery health.

### Canonical state progressions

Milestone 4 should treat these state paths as the shared operating model:

- `invoice`: `draft -> open -> processing -> paid`
- `payment`: `pending -> finalized | failed`
- `webhook delivery`: `failed -> delivered | dead_letter`

The `disabled` webhook delivery state should remain valid as an operational delivery state when no destination is configured, but it is not part of the main happy-path progression.

## Canonical Milestone 4 flow map

The canonical Milestone 4 scenario is a clean one-to-one settlement flow:
one published invoice, one customer payment, one matched payment record, and
one final webhook outcome. This first version intentionally defers advanced
reconciliation cases such as partial payments, overpayments, split transfers,
and manual operator intervention.

1. An operator publishes an invoice and Stablebooks exposes a hosted payment
   page linked to a single organization and settlement wallet configuration.
2. A customer opens the invoice page and receives the exact payment
   instructions for the open invoice, including the target wallet and amount to
   send.
3. The customer sends funds onchain to the settlement wallet associated with
   the invoice's organization.
4. A chain ingestion worker detects a relevant Arc transfer and captures the
   raw transaction signal as soon as it becomes visible onchain.
5. Stablebooks normalizes that transfer into a canonical chain payment
   observation with the minimum fields needed for downstream matching and
   audit.
6. The payment matching layer links the observation to the correct invoice and
   creates or updates the corresponding payment record.
7. Once a valid match exists, Stablebooks moves the payment into
   `processing`, indicating that the payment is recognized but not yet accepted
   as final.
8. After confirmation rules are satisfied, the payment moves to `finalized`;
   if the observation is invalid or cannot be accepted, the payment moves to
   `failed`.
9. Stablebooks emits a webhook that reports the resulting payment state to the
   operator's downstream system.
10. The operator sees the invoice status, payment status, chain metadata, and
    webhook delivery outcome inside the Stablebooks UI.

## Minimum onchain payment observation fields

The first production-shaped Arc ingestion path should normalize every relevant
transfer into one small and stable field set. These fields are enough to power
matching, confirmation, audit visibility, and webhook payloads without
prematurely over-designing the settlement model.

- `txHash`: unique transaction identity for deduplication, audit, and operator linking
- `blockNumber`: ordering and confirmation anchor for settlement progression
- `from`: sender address used for traceability and future risk checks
- `to`: recipient settlement wallet used for organization and invoice routing
- `token`: transferred asset identifier used for payment-rail validation
- `amount`: raw transferred amount used for match and settlement evaluation
- `decimals`: asset precision needed to render and compare amount correctly
- `chainId`: network identity so the payment record is chain-explicit
- `confirmedAt`: timestamp recorded when Stablebooks accepts the observation as confirmed enough for downstream state change

This is the minimum viable onchain contract for Milestone 4. Extra fields such
as log index, block hash, asset symbol, memo or reference data, and raw event
payload snapshots can be added later if ingestion complexity proves they are
needed.

## Milestone 4 ingestion shape

Milestone 4 should introduce one explicit ingestion path from Arc activity into
Stablebooks business state. The goal is not a full event platform. The goal is
one reliable normalization pipeline that can detect candidate payments, dedupe
them, and hand them to the payment matching layer.

### Canonical ingestion stages

1. A chain ingestion worker watches the configured Arc settlement wallet or the
   relevant transfer feed for new incoming payment activity.
2. When a relevant transfer appears, the worker captures the raw chain signal
   and extracts the minimum fields defined in the payment observation contract.
3. The worker normalizes that signal into a canonical chain payment observation
   so downstream logic does not depend on Arc-specific event formatting.
4. Stablebooks deduplicates observations by chain identity, with `txHash` as
   the primary anchor for the first milestone.
5. The normalized observation is persisted and queued for payment matching.
6. The payment resolution layer evaluates whether the observation belongs to a
   known invoice and payment attempt.
7. If a valid match exists, the matched payment can move into `processing` and
   later into `finalized` once confirmation policy is satisfied.
8. If the observation cannot be accepted, Stablebooks preserves the observation
   and drives the linked payment into `failed` only when a concrete settlement
   failure decision is reached.

### Ingestion rules for the first production-shaped version

- ingestion should be wallet-scoped, not chain-global
- ingestion should be append-oriented, so raw observations are not lost when
  matching logic changes later
- ingestion should be idempotent, so the same transfer can be seen multiple
  times without creating duplicate payment effects
- ingestion should be normalization-first, so API and UI code work with one
  internal observation shape instead of raw chain payloads
- ingestion should stay decoupled from webhook delivery, because settlement
  truth must exist even if downstream delivery is temporarily failing

## Milestone 4 persistence shape

Milestone 4 should store payment truth in a small set of durable records with
clear roles. The goal is to keep raw settlement evidence, business resolution,
and operator-facing state separate without overcomplicating the schema.

### Canonical persisted records

- `invoices`: the commercial source of truth for what is owed, whether the
  receivable is still open, and whether the invoice has reached `paid`
- `payments`: the operator-facing settlement record for one invoice payment
  attempt, including the latest resolved onchain fields and lifecycle status
- `chain_payment_observations`: the append-oriented normalized store of
  relevant Arc transfers before business interpretation is finalized
- `payment_matches`: the persisted result of linking one observation to one
  invoice and one payment, including whether the match is exact, unmatched, or
  ambiguous
- `webhook_deliveries`: the outbound operational record for downstream event
  delivery, retry state, and dead-letter visibility

### Persistence rules

- `chain_payment_observations` should be immutable for financial evidence, with
  only processing metadata allowed to change after initial insert
- `payments` should hold the current operator-visible projection of settlement
  truth, including `txHash`, `blockNumber`, `from`, `to`, `token`, `amount`,
  `decimals`, `chainId`, and `confirmedAt`
- `payment_matches` should preserve why Stablebooks accepted, rejected, or
  deferred a candidate transfer instead of burying that logic inside transient
  worker memory
- `invoices` should continue to represent business status, while payment and
  observation tables represent settlement mechanics
- `webhook_deliveries` should never be the source of settlement truth; they are
  downstream effects of payment outcomes, not the primary state machine

## Canonical matching rules

Milestone 4 should start with one narrow, deterministic matching policy. The
first production-shaped version should optimize for exactness and auditability,
not for solving every ambiguous payment case automatically.

### Exact-match path

1. Route the observation to an organization by `chainId` and `to`, using the
   configured settlement wallet as the first filter.
2. Narrow candidates to invoices that are currently `open` or `processing` and
   have an active `payment` record awaiting settlement.
3. Filter candidates by accepted payment rail, meaning the observed `token`
   must be enabled for the invoice or organization payment configuration.
4. Compare observed `amount` and `decimals` against the expected invoice amount
   using one normalized precision model.
5. If exactly one candidate payment remains, create a `payment_match` with
   result `exact` and bind the observation to that payment and invoice.

### Non-exact outcomes

- if no candidate remains, persist the observation as `unmatched` and keep the
  invoice payable
- if more than one candidate remains, persist the result as `ambiguous` and do
  not auto-finalize any payment
- if wallet routing matches but token or amount validation fails for the bound
  payment attempt, persist the result as `rejected`

For the first production-shaped version, Stablebooks should not try to infer
partial payments, combine multiple transfers, or choose between competing
invoice candidates automatically.

## Canonical confirmation policy

Milestone 4 should treat confirmation as a separate decision after detection
and matching. Detection says a transfer exists. Confirmation says Stablebooks
trusts that transfer enough to advance invoice settlement state.

### Payment state policy

- `pending`: a payment attempt exists, but no accepted matched observation is
  yet ready for operator-visible settlement processing
- `processing`: a matched observation exists and passed initial validation, but
  final confirmation policy has not yet been satisfied
- `finalized`: the matched observation passed confirmation policy and is
  accepted as the settled payment outcome
- `failed`: a payment attempt was linked to an observation, but Stablebooks
  later determined that the attempt cannot be accepted as valid settlement

### Confirmation decision rules

- move a payment from `pending` to `processing` once an exact match exists and
  the observation survives basic validation
- move a payment from `processing` to `finalized` only after confirmation rules
  are satisfied and `confirmedAt` is recorded
- move a payment from `processing` to `failed` if the observed transfer is
  reverted, invalidated by confirmation checks, or explicitly rejected after a
  previously linked settlement attempt
- keep an invoice in `open` when observations remain `unmatched` or
  `ambiguous`; only matched accepted settlement should move the invoice forward
- move the invoice to `processing` when its bound payment is `processing`, and
  to `paid` when that payment becomes `finalized`

### Webhook emission policy

The first production-shaped version should emit webhooks on meaningful payment
outcomes, not on every internal state mutation.

- emit `payment.finalized` when settlement becomes final
- emit `payment.failed` when a linked payment attempt is rejected or invalidated
- keep `payment.processing` as an internal event first, unless downstream
  integrators later prove they need non-terminal status notifications

## Sections to complete in the next steps

This foundation is now sufficient to drive Milestone 4 backend and frontend
implementation planning. Future iterations can deepen schemas, job semantics,
and operational runbooks without changing the canonical flow above.
