# Stablebooks Day 25 Hosted Verification

## Runtime target

- API: `https://stablebooks-api-production.up.railway.app/api/v1`
- Web: `https://stablebooks-web-production.up.railway.app`
- Infra: Railway staging

## Verification performed

Day 25 used the hosted Railway runtime as the canonical MVP baseline.

The following checks were run:

- `GET /api/v1/health/runtime`
- `corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging`

## Runtime readiness result

`/health/runtime` returned a green hosted posture:

- service status: `ok`
- storage mode: `postgres_reads`
- Postgres-backed runtime ready: `true`
- hosted runtime policy `policyOk=true`
- hosted JSON fallback allowed: `false`
- Arc source kind: `webhook`
- Arc readiness: `true`
- Arc chain id: `5042002`
- outbound webhook mode: `disabled`

This matches the intended MVP staging posture: Postgres-backed hosted runtime,
Arc webhook-first ingress shape, and outbound webhook delivery safely disabled
until a real merchant destination is configured.

## Hosted rehearsal result

The canonical hosted rehearsal passed.

Observed successful flow:

- invoice: `inv_7dccf7966c31b6d8`
- public token: `pub_e636d71996c14f2161b94f1e`
- invoice status: `paid`
- payment: `pay_7afdda487e37b11c`
- payment status: `finalized`
- match result: `exact`
- provider boundary: `circle_event_monitor`
- source kind: `webhook`
- source profile matched: `true`
- provider warnings: none
- webhook delivery status: `disabled`

## UI smoke result

The hosted Web smoke passed against:

- `/signin`
- `/dashboard`
- `/invoices/inv_7dccf7966c31b6d8`
- `/payments/pay_7afdda487e37b11c`
- `/webhooks?queue=all`
- `/pay/pub_e636d71996c14f2161b94f1e`

All checked pages returned `200` with expected assertions.

## Conclusion

Hosted verification is green for the Day 25 MVP sign-off pass.

