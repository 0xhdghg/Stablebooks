# Stablebooks Day 18 Staging Architecture

## Document status

- Date: `2026-04-25`
- Scope: `Day 18 Slice 2`
- Status: `draft`

## Purpose

This note defines the first hosted staging shape for Stablebooks.

The goal is to keep staging close to the local Day 16 production-runtime
rehearsal while removing local-only assumptions:

- hosted Web
- hosted API
- managed Postgres
- publicly reachable Arc webhook ingress
- optional outbound merchant webhook destination

## Recommended staging shape

Use four main components:

1. Web app
2. API app
3. managed Postgres
4. external webhook callers/receivers

```text
operator browser
-> hosted Web
-> hosted API
-> managed Postgres

Arc/Circle webhook sender
-> hosted API /api/v1/arc/webhooks/events
-> hosted API /api/v1/arc/webhooks/finality

hosted API
-> optional merchant webhook receiver
```

## Component roles

### Web

Responsibility:

- operator sign-in
- dashboard and invoice/payment views
- webhook queue visibility
- hosted customer invoice/payment page

Runtime shape:

- Next.js deployed as a hosted web service
- configured with public `API_BASE_URL`
- no direct database access
- no provider webhook handling

Required property:

- must reach the staging API over public HTTPS

### API

Responsibility:

- auth/session handling
- organizations, wallets, customers, invoices
- payment session creation
- Arc webhook ingestion
- payment matching and terminal transitions
- webhook delivery creation and retry/replay
- operator/API read models

Runtime shape:

- NestJS hosted as a long-running web service
- public HTTPS origin
- connected to managed Postgres
- receives provider webhooks directly
- emits outbound merchant webhooks when configured

Required properties:

- stable public base URL
- secret-backed env configuration
- durable Postgres access
- ability to accept inbound POSTs from provider

### Managed Postgres

Responsibility:

- source of truth for runtime data
- invoice/payment/webhook persistence
- raw chain event storage
- operator/UI reads

Runtime shape:

- separate managed database instance
- not publicly exposed beyond the API allowlist/network controls provided by the
  hosting platform
- migrations applied before first app traffic

Required property:

- `DATABASE_URL` must point only to the staging database

### Arc/Circle provider ingress

Responsibility:

- sends event webhooks into Stablebooks API

Staging posture:

- use webhook-first ingestion
- provider sends to public staging API URL
- provider authenticates with `x-arc-webhook-secret`

Expected endpoints:

- `POST /api/v1/arc/webhooks/events`
- `POST /api/v1/arc/webhooks/finality`

### Outbound merchant webhook receiver

Responsibility:

- receives Stablebooks events such as `payment.finalized` and `payment.failed`

Staging posture:

- optional for first hosted staging
- if unavailable, keep `STABLEBOOKS_WEBHOOK_URL` empty and verify disabled
  delivery records in UI/API
- if available, point to a simple staging receiver owned by us or the merchant

## Recommended deployment topology

### Minimum viable staging

Recommended first hosted layout:

- Web: one hosted Next.js deployment
- API: one hosted Node/NestJS deployment
- Postgres: one managed staging database
- outbound webhook receiver: disabled or simple request bin-style endpoint

This is enough to prove:

- hosted operator access works
- hosted Arc webhook ingress works
- Postgres-backed runtime works outside local development
- smoke scripts work against public URLs

### Non-goals for first staging

Do not require these on the first hosted attempt:

- multiple API replicas
- background worker split
- queue infrastructure
- CDN hardening
- WAF/IP allowlisting
- production-grade metrics/alerting

They can come later after the first hosted flow is stable.

## Canonical staging request flow

```text
operator opens hosted Web
-> Web reads from hosted API
-> operator creates/publishes invoice
-> customer opens hosted pay page
-> provider webhook hits hosted API
-> API writes raw_chain_events/payments/payment_events into Postgres
-> API matches payment to invoice
-> API moves payment to processing/finalized or failed
-> API creates webhook delivery record
-> Web reads updated invoice/payment/webhook state from API
```

## Runtime mode for staging

Staging should run in the same production-like posture proven locally:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
```

Meaning:

- reads come from Postgres-backed services
- writes use Prisma/Postgres paths
- Arc provider enters through webhook mode
- JSON fallback is not the target runtime for staging smoke

## URL contract

The first hosted staging should expose:

- Web base URL:
  - `https://staging-web.example.com`
- API base URL:
  - `https://staging-api.example.com/api/v1`
- Arc webhook base URL:
  - `https://staging-api.example.com`

The exact domains can change by platform, but the separation should stay clear:

- Web calls API
- provider calls API
- browser never calls Postgres directly

## Secrets boundary

Keep these boundaries strict:

- Web holds no database secret
- Web holds no Arc webhook secret
- API holds `DATABASE_URL`
- API holds `ARC_WEBHOOK_SECRET`
- API holds outbound `STABLEBOOKS_WEBHOOK_SECRET`
- provider never receives outbound Stablebooks webhook secret
- merchant receiver never receives `ARC_WEBHOOK_SECRET`

## First hosted staging recommendation

For the first hosted attempt, prefer:

- one Web deployment
- one API deployment
- one managed Postgres database
- outbound merchant webhook disabled unless a receiver is already prepared
- Arc provider webhook enabled only after API readiness is green

This keeps failure analysis simple and close to the proven local runtime.

## Risks to control

Main risks for first hosted staging:

- API starts with wrong runtime flags and silently falls back to JSON
- Web points to the wrong API origin
- provider webhook reaches a private/non-public API URL
- provider secret does not match deployed `ARC_WEBHOOK_SECRET`
- migrations are not applied before API traffic
- staging database is reused with confusing old smoke data

These risks are addressed in later Day 18 slices:

- env/secrets contract
- migration/bootstrap strategy
- deployment checklist
- smoke sequence
- rollback playbook

## Output of this slice

Stablebooks now has a target hosted staging topology:

- hosted Web over HTTPS
- hosted API over HTTPS
- managed Postgres as the single runtime store
- webhook-first Arc ingress into API
- optional outbound merchant webhook receiver

## Next step

Proceed to Day 18 Slice 3:

- document the exact staging env and secrets contract
