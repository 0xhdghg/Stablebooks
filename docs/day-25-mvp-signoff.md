# Stablebooks Day 25 MVP Sign-Off

## Sign-off decision

Stablebooks is accepted as MVP-ready for staging/demo use.

This decision is based on the hosted Railway runtime readiness check and the
canonical hosted staging rehearsal both passing on `2026-04-25`.

## Included in the MVP baseline

- operator sign-in and hosted app shell
- organization, wallet, customer, invoice, and payment flows
- public hosted payment page
- Postgres-backed hosted runtime for core product writes
- Arc webhook-first provider boundary and source profile validation
- on-chain event ingestion shape through hosted webhook rehearsal
- payment matching and terminal finalized/failed transitions
- webhook delivery queue, retry, replay, and dead-letter surfaces
- operator runtime readiness visibility
- hosted smoke/rehearsal automation

## Intentionally deferred

- real merchant outbound webhook destination
- production Circle/Arc provider credential rotation run
- production custom domains
- production monitoring and alerting outside the current Railway/runtime checks
- billing, pricing, and multi-tenant commercial controls

## Blocker review

No MVP-blocking issue was found during Day 25.

Current outbound webhook mode remains `disabled` by design because there is no
real merchant destination configured for staging. This is a known non-blocker,
not a failed runtime state.

## Final MVP statement

Stablebooks can be demonstrated end-to-end on hosted Railway staging as an
Arc-shaped stablecoin receivables MVP:

1. an operator creates and manages receivables;
2. a customer-facing payment page exists for the invoice;
3. an Arc-shaped chain event is ingested through the provider boundary;
4. the payment is matched and finalized against the invoice;
5. the operator can inspect the resulting invoice, payment, runtime posture,
   and webhook queue in the UI.

