# Stablebooks Day 26 Railway Production Launch Checklist

## Document status

- Date: `2026-04-25`
- Scope: `Day 26 Slice 3`
- Status: `accepted`

## Purpose

This checklist defines the single-stack Railway production launch path for
Stablebooks.

It extends the Day 25 hosted staging baseline without changing architecture.

## Target stack

- API: Railway service running `apps/api`
- Web: Railway service running `apps/web`
- Database: Railway Postgres
- Arc ingress: webhook-first provider callbacks into API
- Merchant egress: Stablebooks outbound webhooks from API

## Pre-launch ownership

Before configuring production, assign:

- deployment owner
- database owner
- provider integration owner
- merchant webhook owner
- rollback decision owner
- incident contact

## API service checklist

Required runtime:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
STABLEBOOKS_ENFORCE_HOSTED_RUNTIME_POLICY=true
```

Required secrets:

```env
DATABASE_URL=<railway-postgres-url>
ARC_WEBHOOK_SECRET=<provider-ingress-secret>
STABLEBOOKS_WEBHOOK_SECRET=<merchant-egress-signing-secret>
```

Required safe config:

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=<final-monitored-contract-or-token>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
STABLEBOOKS_WEBHOOK_URL=<merchant-webhook-destination>
```

Optional webhook controls:

```env
STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS=4
STABLEBOOKS_WEBHOOK_RETRY_BASE_MS=5000
STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS=3000
```

Must remain unset unless executing an explicit emergency rollback:

```env
STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=
```

## Web service checklist

Required runtime:

```env
API_BASE_URL=<production-api-origin>/api/v1
```

Production Web must point at the production API service, not staging or local.

## Postgres checklist

Before launch:

- Railway Postgres is provisioned
- `DATABASE_URL` is attached only through Railway secrets
- migrations are applied
- seed/bootstrap path for the launch operator is known
- backup posture is documented
- restore owner is assigned

## Domain checklist

Before provider cutover:

- production API domain resolves to Railway API service
- production Web domain resolves to Railway Web service
- TLS is active for both domains
- provider webhook URL uses the production API domain
- public payment pages use the production Web domain

## Migration checklist

Before deploy:

- confirm latest migration set
- run migrations against production Postgres through the controlled release
  process
- do not manually edit production data during migration
- record migration timestamp and commit SHA

## Readiness checklist

After deploy, verify:

```text
GET /api/v1/health/live
GET /api/v1/health/runtime
```

Expected:

- service status: `ok`
- Postgres reachable: `true`
- Postgres-backed runtime ready: `true`
- hosted runtime policy `policyOk=true`
- hosted JSON fallback allowed: `false`
- Arc readiness: `true`
- Arc source kind: `webhook`
- outbound webhook configured if merchant notifications are in launch scope

## Smoke checklist

Run in this order:

1. API readiness check.
2. Web `/signin` load check.
3. Operator sign-in.
4. Create customer.
5. Create invoice.
6. Open public payment page.
7. Trigger or receive real Arc/Circle provider event.
8. Confirm payment matched.
9. Confirm payment finalized.
10. Confirm merchant webhook delivery.
11. Confirm operator invoice/payment detail pages show expected evidence.

## Rollback checklist

Rollback must use feature flags and preserve payment evidence.

Preferred order:

1. Pause provider ingestion with `ARC_SOURCE_ENABLED=false`.
2. Pause merchant webhooks with empty `STABLEBOOKS_WEBHOOK_URL`.
3. Roll back a specific Postgres write mode only if the issue is scoped to that
   write path.
4. Use hosted JSON fallback only as an explicit emergency path.

Do not delete:

- raw chain events
- payments
- payment events
- webhook deliveries

## Production launch sign-off

Launch can be called production-ready only when:

- readiness is green
- real provider event path is verified
- merchant webhook delivery path is verified
- rollback owner is available
- no production secret is committed
- launch commit SHA is recorded
