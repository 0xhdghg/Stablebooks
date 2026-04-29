# Stablebooks Day 32 Hosted Verification

## Runtime

- API: `https://stablebooks-api-production.up.railway.app`
- Web: `https://stablebooks-web-production.up.railway.app`
- Environment: Railway `production`
- Date: `2026-04-29`

## Deployment

The API was deployed to Railway with:

```text
Deploy Day 32 auto-rematch race fix
```

## Health checks

Liveness:

```text
GET /api/v1/health/live -> ok
```

Storage readiness:

```text
storageMode -> postgres_reads
postgresBackedRuntimeReady -> true
invoiceWriteMode -> postgres
paymentSessionWriteMode -> postgres
matchingWriteMode -> postgres
terminalPaymentWriteMode -> postgres
webhookWriteMode -> postgres
hostedRuntimePolicy.policyOk -> true
```

## Race smoke

The hosted smoke exercised the Day 32 timing case:

1. Created a published invoice.
2. Ingested a confirmed Arc-shaped chain observation before creating the
   payment session.
3. Created the public payment session.
4. Verified the backend rematched and finalized automatically.

Result:

```text
ok -> true
referenceCode -> SB-6727DC
invoiceId -> inv_10db16ec28804cea
publicToken -> pub_74055b753d11db103bca0181
paymentId -> pay_3b4f5502306cff36
invoiceStatus -> paid
paymentStatus -> finalized
matchResult -> exact
publicStatus.redirectHint -> success
```

Receipt URL:

```text
https://stablebooks-web-production.up.railway.app/pay/pub_74055b753d11db103bca0181/processing
```

## Note

The first smoke request was sent before Railway had fully rolled out the new
deployment and remained pending. The repeated smoke after rollout passed.
