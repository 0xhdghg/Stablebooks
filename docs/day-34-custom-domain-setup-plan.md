# Stablebooks Day 34 Custom Domain Setup Plan

## Goal

Move the public launch surface from Railway-generated URLs to a branded domain
without changing product architecture.

Target domains:

```text
Web -> https://stablebooks-app.xyz
API -> https://api.stablebooks-app.xyz/api/v1
```

The existing Railway URLs should remain available as rollback/debug URLs:

```text
Web fallback -> https://stablebooks-web-production.up.railway.app
API fallback -> https://stablebooks-api-production.up.railway.app/api/v1
```

## Scope

- No code changes required for the first domain cutover.
- No database changes.
- No payment matching changes.
- No Arc source changes.
- Only Railway custom domains, DNS records, env updates, redeploy, and smoke.

## Railway Domain Mapping

Add custom domains in Railway:

```text
stablebooks-web service:
  stablebooks-app.xyz

stablebooks-api service:
  api.stablebooks-app.xyz
```

Optional but recommended:

```text
stablebooks-web service:
  www.stablebooks-app.xyz
```

If `www` is added, choose one canonical user-facing URL and keep the other as a
redirect/compatibility URL at the DNS or host layer.

## DNS Records

Use the DNS target values shown by Railway after adding each custom domain.
Do not hardcode Railway targets in docs because Railway may generate
service-specific targets.

Expected DNS shape:

```text
stablebooks-app.xyz      -> Railway Web custom domain target
api.stablebooks-app.xyz  -> Railway API custom domain target
www.stablebooks-app.xyz  -> Railway Web custom domain target, optional
```

If the DNS provider supports CNAME flattening, ALIAS, or ANAME at the apex,
use that for `stablebooks-app.xyz`.

If the provider does not support apex CNAME-style records, use
`www.stablebooks-app.xyz` as the canonical web URL and redirect the apex to
`www`.

## API Environment Variables

Update the Railway `stablebooks-api` service:

```text
APP_BASE_URL=https://stablebooks-app.xyz
CORS_ALLOWED_ORIGINS=https://stablebooks-web-production.up.railway.app,https://stablebooks-app.xyz,https://www.stablebooks-app.xyz
```

Keep the Railway Web origin in `CORS_ALLOWED_ORIGINS` during the transition so
the fallback Web URL still works.

Do not change Arc variables during domain setup.

Do not change:

```text
ARC_SOURCE_KIND
ARC_CHAIN_ID
ARC_EVENT_CONTRACT_ADDRESS
ARC_EVENT_SIGNATURE
ARC_EVENT_TOKEN_SYMBOL
ARC_EVENT_TOKEN_DECIMALS
ARC_START_BLOCK
DATABASE_URL
```

## Web Environment Variables

Update the Railway `stablebooks-web` service:

```text
API_BASE_URL=https://api.stablebooks-app.xyz/api/v1
NEXT_PUBLIC_API_BASE_URL=https://api.stablebooks-app.xyz/api/v1
```

Keep the old Railway API URL available only as a rollback value:

```text
https://stablebooks-api-production.up.railway.app/api/v1
```

## Deployment Order

1. Add Railway custom domain to `stablebooks-web`.
2. Add Railway custom domain to `stablebooks-api`.
3. Add DNS records using the exact targets Railway provides.
4. Wait for Railway domain status and TLS certificate provisioning.
5. Update `stablebooks-api` env.
6. Deploy/redeploy `stablebooks-api`.
7. Update `stablebooks-web` env.
8. Deploy/redeploy `stablebooks-web`.
9. Run post-domain smoke.

## Post-Domain Smoke

Run these checks after DNS and redeploy:

```text
GET https://api.stablebooks-app.xyz/api/v1/health/live
GET https://api.stablebooks-app.xyz/api/v1/health/storage
GET https://api.stablebooks-app.xyz/api/v1/health/runtime
GET https://stablebooks-app.xyz
```

Expected:

```text
API health -> 200 ok
Web -> 200
Web page contains Stablebooks
runtime storageMode -> postgres_reads
runtime arc.ready -> true
runtime arc.sourceKind -> rpc_polling
```

Then perform a browser smoke:

```text
open https://stablebooks-app.xyz
sign in
open Invoices
open latest finalized invoice
open public success URL on the custom domain
confirm receipt renders
```

Expected public success URL shape:

```text
https://stablebooks-app.xyz/pay/<public-token>/success
```

## Payment Flow Smoke After Domain Setup

Before public launch, run one small invoice smoke:

```text
create invoice -> open custom-domain payment page -> pay exact Arc Testnet USDC
-> wait for success -> confirm operator invoice detail
```

Required evidence:

```text
invoiceStatus -> paid
paymentStatus -> finalized
matchResult -> exact
txHash -> present
blockNumber -> present
sourceConfirmedAt -> present
```

## Rollback

If custom domain setup breaks Web/API communication:

1. Revert `stablebooks-web` env:

```text
API_BASE_URL=https://stablebooks-api-production.up.railway.app/api/v1
NEXT_PUBLIC_API_BASE_URL=https://stablebooks-api-production.up.railway.app/api/v1
```

2. Keep or revert `stablebooks-api` CORS:

```text
APP_BASE_URL=https://stablebooks-web-production.up.railway.app
CORS_ALLOWED_ORIGINS=https://stablebooks-app.xyz,https://www.stablebooks-app.xyz
```

3. Redeploy API and Web.
4. Use the Railway URLs for launch delay/debug only.

## Go / No-Go Criteria

Go if:

```text
stablebooks-app.xyz loads
api.stablebooks-app.xyz health/runtime is ok
sign in works
invoice list loads
public payment success route works
new small Arc Testnet payment finalizes
```

No-go if:

```text
TLS is not provisioned
API CORS blocks Web requests
sign in fails only on custom domain
public payment polling fails only on custom domain
new Arc payment cannot finalize
```
