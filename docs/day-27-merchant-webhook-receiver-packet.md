# Stablebooks Day 27 Merchant Webhook Receiver Packet

## Document status

- Date: `2026-04-25`
- Scope: `Day 27 Slice 3`
- Status: `accepted`

## Purpose

This packet defines the external merchant webhook receiver requirements for a
production launch rehearsal.

Stablebooks already has outbound webhook delivery, retry, replay, and
dead-letter surfaces. Production launch requires a real receiver that can
prove merchant notification behavior end-to-end.

## Required owner

Assign one merchant webhook owner before execution.

The owner is responsible for:

- receiver URL
- receiver availability
- signature verification
- idempotency behavior
- failure/recovery testing
- launch evidence capture

## Required inputs

Stablebooks API needs:

```text
STABLEBOOKS_WEBHOOK_URL=<merchant-webhook-destination>
STABLEBOOKS_WEBHOOK_SECRET=<merchant-egress-signing-secret>
```

Optional controls:

```text
STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS=4
STABLEBOOKS_WEBHOOK_RETRY_BASE_MS=5000
STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS=3000
```

`STABLEBOOKS_WEBHOOK_SECRET` must not equal `ARC_WEBHOOK_SECRET`.

## Receiver requirements

The merchant receiver must:

- be reachable over HTTPS
- accept Stablebooks webhook payloads
- verify the Stablebooks signature
- return `2xx` only after safe receipt
- reject invalid signatures
- tolerate duplicate event deliveries
- record event or delivery identifiers for idempotency
- keep request logs long enough for launch verification

## Required event types

The first production launch rehearsal must cover:

- `payment.finalized`
- `payment.failed`

`payment.finalized` is mandatory for launch.

`payment.failed` can be verified in a controlled failure run if doing so is safe
for the selected environment.

## Test matrix

### Success path

Input:

- valid destination URL
- valid signing secret
- finalized payment

Expected:

- delivery status becomes `success`
- receiver logs one accepted event
- operator UI shows successful delivery state

### Invalid signature path

Input:

- receiver expects a different secret
- Stablebooks sends a signed event

Expected:

- receiver rejects the request
- Stablebooks records non-success delivery
- retry behavior is observable
- no payment evidence is deleted or rewritten

### Non-2xx path

Input:

- receiver returns non-2xx

Expected:

- attempt count increases
- `nextAttemptAt` is set according to retry policy
- delivery eventually becomes failed or dead-lettered after max attempts

### Replay path

Input:

- destination is fixed after failed/dead-letter state
- operator triggers replay

Expected:

- replay creates or updates delivery state according to existing behavior
- receiver accepts the event
- operator UI shows replay result

## Evidence to capture

For each tested path, capture:

- invoice id
- payment id
- delivery id
- event type
- delivery status
- attempt count
- receiver response status
- receiver-side event id or log reference

Do not capture:

- `STABLEBOOKS_WEBHOOK_SECRET`
- `ARC_WEBHOOK_SECRET`
- receiver private credentials

## Stablebooks UI verification

The operator should verify:

- `/webhooks?queue=all`
- delivery detail state if available
- invoice detail latest payment state
- payment detail provider and webhook posture

## No-go conditions

Do not claim merchant webhook readiness if:

- `STABLEBOOKS_WEBHOOK_URL` is empty
- receiver does not verify signatures
- duplicate delivery behavior is unknown
- retry behavior is unobserved
- dead-letter behavior is unobserved
- replay behavior is unobserved
- evidence includes real secrets
