# Stablebooks Day 27 Domain And Env Mapping

## Document status

- Date: `2026-04-25`
- Scope: `Day 27 Slice 4`
- Status: `accepted`

## Purpose

This document maps production domains to Railway services and environment
variables.

The goal is to prevent provider callbacks, Web pages, and API calls from
accidentally crossing staging, local, and production origins.

## Domain placeholders

Final production values must be supplied by the deployment owner.

```text
Production API origin: <production-api-origin>
Production Web origin: <production-web-origin>
Railway API service: <railway-api-service>
Railway Web service: <railway-web-service>
Railway Postgres: <railway-postgres-service>
```

Do not commit real DNS provider credentials or Railway tokens.

## API domain mapping

Production API domain must point to the Railway API service.

Used by:

- Web `API_BASE_URL`
- Arc/Circle provider webhook callback URL
- health checks
- hosted launch rehearsal commands

Required API endpoints:

```text
GET  <production-api-origin>/api/v1/health/live
GET  <production-api-origin>/api/v1/health/runtime
POST <production-api-origin>/api/v1/arc/webhooks/events
POST <production-api-origin>/api/v1/arc/webhooks/finality
```

## Web domain mapping

Production Web domain must point to the Railway Web service.

Used by:

- operator sign-in
- dashboard
- invoice detail
- payment detail
- webhook queue
- public hosted payment pages

Required Web routes:

```text
<production-web-origin>/signin
<production-web-origin>/dashboard
<production-web-origin>/invoices/<invoice-id>
<production-web-origin>/payments/<payment-id>
<production-web-origin>/webhooks?queue=all
<production-web-origin>/pay/<public-token>
```

## Railway API env mapping

Required API runtime:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
STABLEBOOKS_ENFORCE_HOSTED_RUNTIME_POLICY=true
STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=
```

Required API secrets:

```env
DATABASE_URL=<railway-postgres-url>
ARC_WEBHOOK_SECRET=<provider-ingress-secret>
STABLEBOOKS_WEBHOOK_SECRET=<merchant-egress-signing-secret>
```

Required Arc config:

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=<final-chain-id>
ARC_EVENT_MONITOR_SOURCE=<provider-source-name>
ARC_EVENT_CONTRACT_ADDRESS=<final-monitored-contract-or-token>
ARC_EVENT_SIGNATURE=<final-event-signature>
ARC_EVENT_TOKEN_SYMBOL=<final-token-symbol>
ARC_EVENT_TOKEN_DECIMALS=<final-token-decimals>
```

Required merchant webhook config:

```env
STABLEBOOKS_WEBHOOK_URL=<merchant-webhook-destination>
```

## Railway Web env mapping

Required Web runtime:

```env
API_BASE_URL=<production-api-origin>/api/v1
```

The Web service must not point to:

- `127.0.0.1`
- `localhost`
- staging API if executing production launch
- any API origin with embedded credentials

## Provider callback mapping

Provider event callback:

```text
<production-api-origin>/api/v1/arc/webhooks/events
```

Provider finality callback:

```text
<production-api-origin>/api/v1/arc/webhooks/finality
```

Provider callback must not point at the Web origin.

Provider callback must not point at local tunneling URLs for production launch.

## Public payment page mapping

Customer-facing payment page:

```text
<production-web-origin>/pay/<public-token>
```

The payment page must use the production Web origin, while API calls from Web
must use `API_BASE_URL`.

## Preflight checks

Before launch rehearsal:

- API domain resolves
- Web domain resolves
- TLS is active for API
- TLS is active for Web
- `GET /api/v1/health/live` returns `ok`
- `GET /api/v1/health/runtime` returns hosted policy `policyOk=true`
- Web `/signin` returns `200`
- Web public payment page can be opened for a test invoice
- provider callback URL exactly matches production API origin
- merchant webhook URL points to intended receiver

## No-go conditions

Do not execute production dependency verification if:

- API and Web domains are swapped
- Web points at local or staging API
- provider callback URL points at Web origin
- provider callback URL points at staging by accident
- TLS is not active
- secrets are embedded in URLs
- `STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=true` is set without an explicit
  emergency rollback reason
