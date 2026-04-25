# Stablebooks Day 4 Acceptance Note

## Document status

- Date: `2026-04-21`
- Scope: `Day 4 real Arc ingestion adapter`
- Status: `accepted`

## Acceptance summary

Day 4 is accepted for the current MVP stage.

Stablebooks now has a production-shaped Arc webhook ingestion path that can
accept Arc-style settlement events, persist raw evidence, normalize them into
payment observations, run the existing matching flow, move payments through
`processing` into a terminal state, emit outbound webhook deliveries, and show
the resulting settlement state in the operator UI.

## Accepted capabilities

- Arc source strategy is documented as webhook-first for the MVP.
- Canonical Arc event contract is documented and implemented around:
  - `txHash`
  - `blockNumber`
  - `from`
  - `to`
  - `token`
  - `amount`
  - `decimals`
  - `chainId`
  - `confirmedAt`
- Arc runtime configuration exists for source enablement, source kind, chain ID,
  webhook secret, polling interval, confirmation count, and optional start
  block.
- Dev-only Arc routes exist for local adapter readiness, state inspection,
  fixtures, and direct provider-style ingestion.
- Production-shaped Arc webhook routes exist:
  - `POST /api/v1/arc/webhooks/events`
  - `POST /api/v1/arc/webhooks/finality`
- Webhook ingress validates source mode and `x-arc-webhook-secret`.
- Arc events persist into the raw evidence layer before being normalized.
- Normalized observations preserve Arc source confirmation semantics through
  `sourceConfirmedAt`.
- Matching is triggered from the Arc path without using `payments/mock/*`.
- Arc finality can move matched payments to `finalized` or `failed`.
- Terminal Arc transitions emit the same outbound webhook delivery model used by
  the existing payment backend.
- Operator UI shows Arc-originated payment state, confirmation fields, webhook
  delivery state, and failure reasons.

## Verified smoke paths

### Finalized path

- Provider payload enters through `POST /api/v1/arc/webhooks/events`.
- Raw chain event is created.
- Observation is normalized and matched.
- Payment moves to `processing`.
- Finality payload enters through `POST /api/v1/arc/webhooks/finality`.
- Payment moves to `finalized`.
- Linked invoice moves to `paid`.
- Observation moves to `confirmed`.
- `payment.finalized` delivery is created.
- Operator pages show:
  - `arc_ingestion`
  - `Chain source confirmed at`
  - `Stablebooks terminal confirmed at`
  - disabled webhook delivery when no destination is configured

### Failed path

- Provider payload enters through `POST /api/v1/arc/webhooks/events`.
- Raw chain event is created.
- Observation is normalized and matched.
- Payment moves to `processing`.
- Finality payload enters through `POST /api/v1/arc/webhooks/finality` with
  `outcome=failed`.
- Payment moves to `failed`.
- Linked invoice returns to `open`.
- Observation moves to `rejected`.
- `payment.failed` delivery is created.
- Operator pages show:
  - failure reason
  - `arc_ingestion`
  - source confirmation fields
  - disabled webhook delivery when no destination is configured

## Current boundaries

The Day 4 implementation is intentionally not a full production Arc connector
yet. These items remain outside the accepted Day 4 scope:

- real Arc provider account setup
- real hosted webhook registration in Arc provider infrastructure
- real Arc RPC polling
- signature verification beyond the local shared-secret MVP shape
- multi-chain expansion
- partial payment accounting
- overpayment accounting
- production database replacement for the local JSON store
- background reconciliation against missed provider events

## Product meaning

After Day 4, Stablebooks is no longer only a mock-payment demo. The core payment
backend now has the shape of a real Arc-native receivables system:

- invoices define what should be paid
- wallets define where funds should arrive
- Arc events describe what happened onchain
- Stablebooks matches those events to invoices
- payments move through deterministic states
- operators can audit the whole path in the UI
- customers can be notified through webhook deliveries

## Next recommended day

The next day should focus on production hardening, not new product surface.

Recommended Day 5 theme:

- replace local JSON persistence with the agreed Postgres/Prisma path in the
  running API
- preserve the accepted Day 4 Arc/payment behavior against real database
  constraints
- add regression tests for the finalized and failed Arc paths
