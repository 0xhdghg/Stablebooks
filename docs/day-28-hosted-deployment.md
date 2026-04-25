# Stablebooks Day 28 Hosted Deployment

## Document status

- Date: `2026-04-25`
- Scope: `Day 28 Railway API deploy`
- Status: `accepted`

## Deployment target

- Railway project: `stablebooks-staging`
- Railway environment: `production`
- Service: `stablebooks-api`
- API URL: `https://stablebooks-api-production.up.railway.app`

## Deployment performed

The Day 28 backend changes were deployed to Railway API service.

Deployment id:

```text
bc002eee-4cde-43e5-b808-5dbe670454d0
```

The deploy completed successfully.

## Runtime configuration update

The hosted API Arc source profile now uses the Circle-imported Arc Testnet USDC
contract:

```text
ARC_EVENT_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
```

Day 29 supersedes this source profile for the normal MetaMask wallet-send
flow. Real wallet sends emit native Arc USDC logs from
`0x1800000000000000000000000000000000000000` with 18 decimals.

No secret values are recorded in this document.

## Verification performed

Hosted readiness checks:

```text
GET /api/v1/health/live
GET /api/v1/health/runtime
```

Observed:

- API status: `ok`
- Postgres-backed runtime ready: `true`
- hosted runtime policy `policyOk=true`
- Arc source kind: `webhook`
- Arc readiness: `true`
- Arc contract address: `0x3600000000000000000000000000000000000000`

Circle path smoke:

- sending Circle headers without `CIRCLE_API_KEY` returns service-unavailable
  behavior, confirming the deployed API is using the Day 28 Circle verification
  path instead of the legacy shared-secret path.

Hosted rehearsal:

```text
corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging
```

Observed successful flow:

- invoice: `inv_5abc407b4117e5c4`
- payment: `pay_c3c1f7b720f44d81`
- invoice status: `paid`
- payment status: `finalized`
- match result: `exact`
- provider boundary: `circle_event_monitor`
- source profile matched: `true`
- hosted Web smoke: passed

## Remaining external step

`CIRCLE_API_KEY` is not yet configured in Railway.

Before replacing webhook.site in Circle Console, add the Circle API key to the
Railway API service secrets:

```text
CIRCLE_API_KEY=<circle-api-key>
```

Then update Circle Console webhook URL to:

```text
https://stablebooks-api-production.up.railway.app/api/v1/arc/webhooks/events
```
