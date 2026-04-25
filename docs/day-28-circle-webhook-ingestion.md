# Stablebooks Day 28 Circle Webhook Ingestion

## Document status

- Date: `2026-04-25`
- Scope: `Day 28 implementation note`
- Status: `accepted`

## Purpose

Day 28 adds the backend path required for Circle Console webhooks.

During Day 27 manual setup, Circle was observed sending:

- `x-circle-key-id`
- `x-circle-signature`
- signed JSON payloads

The previous Stablebooks webhook path expected `x-arc-webhook-secret`, which is
still useful for hosted rehearsals but does not match Circle Console webhook
delivery.

## Implemented behavior

`POST /api/v1/arc/webhooks/events` now supports two auth paths:

- Circle-signed webhook path when Circle headers are present
- existing `x-arc-webhook-secret` path when Circle headers are absent

Circle-signed path:

1. reads the raw request body
2. reads `x-circle-key-id`
3. reads `x-circle-signature`
4. loads the Circle public key
5. verifies the signature with SHA-256/ECDSA
6. rejects invalid signatures
7. handles supported Circle notification types

## Circle notification handling

Supported:

- `webhooks.test`
- `contracts.eventLog`

`webhooks.test` returns a safe acknowledgement and does not create payment
evidence.

`contracts.eventLog` is passed into the existing Circle Event Monitor provider
decoder and then through the existing payment matching flow.

Unsupported Circle notification types are rejected safely.

## Public key loading

Production-like path:

```env
CIRCLE_API_KEY=<circle-api-key>
```

Stablebooks uses the Circle public key lookup endpoint with the received
`x-circle-key-id`.

Controlled regression/local path:

```env
CIRCLE_WEBHOOK_PUBLIC_KEYS_JSON=<json-map-of-key-id-to-public-key>
```

This avoids committing real Circle API credentials and allows deterministic
tests.

## Preserved behavior

The existing rehearsal path remains valid:

```text
x-arc-webhook-secret: <ARC_WEBHOOK_SECRET>
```

This keeps hosted rehearsal and smoke scripts compatible while Circle Console
integration moves to signed webhook verification.

## Not included

Day 28 did not:

- change database schema
- change payment status semantics
- change UI
- switch Circle Console from webhook.site to Stablebooks API
- execute a real Arc Testnet USDC transfer
- commit any Circle API key or secret

## Next external step

After deploy, update Circle Console webhook URL from webhook.site to:

```text
https://stablebooks-api-production.up.railway.app/api/v1/arc/webhooks/events
```

Then run a real Arc Testnet USDC transfer that emits the monitored `Transfer`
event.

