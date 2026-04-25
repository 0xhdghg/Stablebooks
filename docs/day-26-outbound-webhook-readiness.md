# Stablebooks Day 26 Outbound Webhook Readiness

## Document status

- Date: `2026-04-25`
- Scope: `Day 26 Slice 5`
- Status: `accepted`

## Purpose

This document defines what must be true before Stablebooks outbound merchant
webhooks can be considered production-ready.

Day 25 accepted the MVP with outbound webhooks intentionally disabled in hosted
staging. Production launch requires a real merchant destination and successful
delivery verification.

## Required production config

```env
STABLEBOOKS_WEBHOOK_URL=<merchant-webhook-destination>
STABLEBOOKS_WEBHOOK_SECRET=<stablebooks-outbound-signing-secret>
STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS=4
STABLEBOOKS_WEBHOOK_RETRY_BASE_MS=5000
STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS=3000
```

`STABLEBOOKS_WEBHOOK_SECRET` must be independent from `ARC_WEBHOOK_SECRET`.

## Destination requirements

The merchant webhook receiver must:

- accept HTTPS requests
- return `2xx` only after safely receiving the event
- tolerate duplicate event deliveries
- verify Stablebooks webhook signatures
- record event id or delivery id for idempotency
- avoid depending on delivery order as the only correctness mechanism

## Event scope for launch

At launch, the required outbound event types are:

- `payment.finalized`
- `payment.failed`

Other merchant notification events can remain post-launch.

## Readiness checks

Before production launch:

- set `STABLEBOOKS_WEBHOOK_URL`
- set `STABLEBOOKS_WEBHOOK_SECRET`
- run a controlled finalized payment flow
- confirm delivery status becomes `success`
- run a controlled failed payment flow if safe
- confirm failed event delivery behavior
- force or simulate a non-2xx destination response
- confirm retry attempts increase
- confirm dead-letter behavior after max attempts
- replay one failed or dead-letter delivery after fixing the destination

## Operator UI expectations

The operator must be able to inspect:

- webhook delivery queue
- delivery status
- event type
- attempt count
- next attempt time
- response status
- dead-letter state
- replay result

## Safe disabled state

An empty `STABLEBOOKS_WEBHOOK_URL` is a safe pause state.

Expected behavior:

- payment finality still works
- delivery records can be created as disabled
- chain evidence is not deleted
- operator UI can still inspect payment state

This is acceptable for staging/demo, but not for a production launch that
promises merchant notifications.

## Failure handling

If merchant delivery fails:

- do not replay the Arc provider event first
- inspect the delivery record
- fix destination URL or merchant receiver behavior
- use retry/replay controls intentionally
- preserve all delivery history

If signatures fail:

- rotate or correct `STABLEBOOKS_WEBHOOK_SECRET`
- do not reuse `ARC_WEBHOOK_SECRET`
- do not paste secret values into logs, docs, or tickets

## Pass criteria

Outbound webhooks are production-ready when:

- production destination URL is configured
- signing secret is configured independently from Arc ingress
- `payment.finalized` delivery succeeds
- retry behavior works on non-2xx response
- dead-letter behavior is observable
- replay works after destination recovery
- operator UI shows the complete delivery state

## No-go criteria

Do not claim outbound webhooks are production-ready if:

- `STABLEBOOKS_WEBHOOK_URL` is empty
- merchant receiver does not verify signatures
- duplicate delivery behavior is unknown
- dead-letter behavior is untested
- replay behavior is untested
- delivery history is manually edited or deleted
