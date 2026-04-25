# Stablebooks Day 2.5 Storage Hardening Plan

## Document status

- Date: `2026-04-20`
- Scope: `post-Day-2 storage hardening`
- Status: `active`

## Goal

Close the highest-value storage and data-contract gaps that are worth solving
before deeper payment-ingestion work continues.

This is not a full schema redesign. It is a focused hardening pass on the
parts most likely to cause rework later.

## Priority plan

1. Define the invoice aggregation contract.
2. Lock amount type decisions for raw and normalized values.
3. Define the fallback idempotency rule when `logIndex` is unavailable.
4. Decide whether unmatched payments should exist in `payments` or only in raw
   and observation layers.
5. Decide whether invoice statuses need expansion now or can stay deferred.

## Step 1. Invoice aggregation contract

### Why this comes first

Invoice settlement is currently simple: one clean finalized payment can mark an
invoice as paid.

That is good enough for the current product slice, but the next storage
decisions depend on a clearer rule for:

- multiple payment attempts
- duplicate transfers
- partial settlement
- overpayment behavior

### Canonical rule for the next stage

For the next hardening step, Stablebooks should treat invoice settlement as an
aggregation over accepted finalized payments, not over raw chain events.

The canonical aggregation source is:

- `sum(finalized payments for invoice)`

The aggregation should not look at:

- `raw_chain_events`
- `chain_payment_observations`
- `processing` payments
- `failed` payments

### Proposed settlement interpretation

- if finalized sum is `0`, invoice remains payable
- if finalized sum is greater than `0` and less than expected amount, invoice
  is partially settled
- if finalized sum equals expected amount, invoice is paid
- if finalized sum is greater than expected amount, invoice is overpaid

### Current implementation stance

Stablebooks should **not** implement `partial` and `overpaid` UI semantics yet.

For now we should:

- keep the current invoice runtime statuses for the active product flow
- document aggregation rules now
- delay status expansion until the next payment flow actually needs operator
  surfaces for partial settlement or overpayment

### Resulting decision

Decision:

- invoice aggregation is a real next-step contract and should be modeled at the
  data-contract level now
- invoice status expansion is deferred until the surrounding API and UI need it

### Follow-up implications

This decision affects:

- whether `Invoice` should later add statuses such as `partially_paid` and
  `overpaid`
- how payment finalization updates invoice state
- how reconciliation and operator views should summarize invoice settlement

## Step 2. Amount type decisions

### Why this matters

If amount fields are underspecified, payment matching and operator debugging
will become inconsistent very quickly.

We need one clear rule for:

- commercial invoice amounts
- raw onchain token amounts
- normalized amounts used in matching and rendering

### Canonical amount split

Stablebooks should keep three different amount shapes for three different
jobs.

1. `invoice commercial amount`
   Stored as minor units in billing currency, such as cents.

2. `raw onchain amount`
   Stored as the exact atomic token amount observed onchain.

3. `normalized settlement amount`
   Stored as a decimal value derived from atomic amount and token decimals.

### Recommended storage contract

- invoice-facing commercial amounts may stay as integer minor units for now
- raw onchain atomic amounts should be treated as arbitrary-precision values
- normalized settlement amounts should be stored as decimal values

### Current implementation stance

Current schema already reflects part of this split:

- `Invoice.amountMinor`
- `Payment.amountMinor`
- `Payment.amountAtomic`
- `ChainPaymentObservation.amountAtomic`
- `RawChainEvent.amountAtomic`
- `Payment.normalizedAmount`

### Decision for the next step

Decision:

- keep invoice commercial amounts as minor-unit integers for the active product
  slice
- keep normalized settlement amounts as decimal values
- upgrade raw onchain amounts from plain string semantics to an explicit
  arbitrary-precision numeric contract in the next schema pass

### Practical note

For EVM-style token transfers, signed 64-bit integer storage is not a safe
universal raw amount contract.

The next schema-hardening pass should prefer one of:

- `numeric(78,0)` in Postgres
- or a deliberately documented text contract if we intentionally keep parsing
  and validation in application code

The key is not the exact type name. The key is explicitly guaranteeing that raw
onchain values do not lose precision.

## Step 3. Fallback idempotency rule

### Why this matters

The strongest ingestion identity for EVM-style transfer events is:

- `chainId + txHash + logIndex`

But not every upstream source guarantees that `logIndex` is present at the
moment the event is first observed.

If we do not define fallback behavior now, duplicate detection may become
inconsistent across ingestion retries and provider differences.

### Canonical idempotency rule

Stablebooks should use a two-tier idempotency contract.

Primary identity:

- `chainId + txHash + logIndex`

Fallback identity when `logIndex` is unavailable:

- `chainId + txHash + toAddress + amountAtomic`

### Interpretation rule

The fallback key is a temporary deduplication key, not the final canonical
chain-event identity.

That means:

- use the fallback key only when `logIndex` is genuinely unavailable
- prefer upgrading the stored record to the stronger identity once `logIndex`
  becomes known
- do not permanently treat fallback and primary identity as equivalent in audit
  semantics

### Conflict handling

If a fallback-key match already exists and later the same transfer is observed
with a concrete `logIndex`, Stablebooks should reconcile by attaching the
stronger identity to the existing record rather than inserting a second event.

If multiple candidate events could map to the same fallback key, Stablebooks
should keep the record flagged for review rather than silently merging them as
one canonical event.

### Current implementation stance

Current schema already stores `logIndex` with a default of `0` for:

- `RawChainEvent`
- `ChainPaymentObservation`

This gives the current system a stable development identity, but it is not yet
the same as a fully explicit fallback contract.

### Decision for the next step

Decision:

- keep `chainId + txHash + logIndex` as the canonical storage identity
- document `chainId + txHash + toAddress + amountAtomic` as the fallback
  ingestion identity when `logIndex` is absent
- treat fallback identity as a temporary ingest-time dedupe strategy, not as
  the long-term audit identity

## Step 4. Unmatched payments boundary

### Why this matters

If unmatched onchain signals create rows in `payments`, the payment table stops
meaning "business settlement record" and starts meaning "any chain-like thing
we noticed".

That usually makes operator behavior, reconciliation logic, and debugging more
confusing over time.

### Canonical boundary

Stablebooks should keep unmatched activity out of the `payments` table.

The intended layer split is:

- `raw_chain_events`: raw append-only evidence
- `chain_payment_observations`: normalized candidate settlement signals
- `payment_matches`: matching result, including `exact`, `unmatched`,
  `ambiguous`, or `rejected`
- `payments`: invoice-bound settlement records that belong to the business
  workflow

### Decision rule

Create or update a `payment` only when one of these is true:

- a hosted invoice flow already created an invoice-bound payment attempt
- a normalized observation is matched to a known invoice and is being promoted
  into the business settlement lifecycle

Do not create a `payment` just because:

- a raw transfer was detected
- an observation exists
- a transfer is still unmatched
- a transfer is ambiguous

### Current implementation stance

Current Stablebooks flow already leans in this direction:

- hosted payment flow creates invoice-bound `payments`
- unmatched and ambiguous chain activity are represented through normalized
  observations and match results

That is the right shape to preserve.

### Why this is the recommended contract

This keeps:

- `payments` clean for operator-facing settlement history
- matching idempotent and replay-safe
- unmatched chain activity debuggable without polluting finance objects
- future reconciliation tooling easier to reason about

### Decision for the next step

Decision:

- unmatched payment-like records should live in `raw_chain_events`,
  `chain_payment_observations`, and `payment_matches`
- `payments` should remain a business-layer object, not the universal sink for
  every detected transfer

## Step 5. Invoice status expansion timing

### Why this is a decision

More invoice statuses can improve business precision, but only if the product
actually uses them in operator flows and settlement logic.

Potential future statuses include:

- `partially_paid`
- `expired`
- `overpaid`

### Current recommendation

Stablebooks should **not** expand `InvoiceStatus` yet.

The current runtime flow is still centered on one clean invoice settlement
path, and these extra statuses would add backend and UI complexity before the
product is ready to use them well.

### Deferred requirement

These statuses will likely be needed in a later stage when Stablebooks adds:

- partial settlement handling
- expiry logic with operator visibility
- overpayment handling and reconciliation surfaces

### Decision

Decision:

- future invoice statuses such as `partially_paid`, `expired`, and `overpaid`
  are explicitly recognized as necessary for a later payment and
  reconciliation stage
- `InvoiceStatus` remains unchanged for the current product slice
- status expansion should happen only when the surrounding API, state
  transitions, and UI are ready to use those states deliberately

## Exit condition

This Day 2.5 plan is complete when each item above is converted from an open
question into a short explicit rule in docs, with schema changes only where the
decision clearly improves the current system.
