# Stablebooks Day 23 Hosted Verification

## Runtime target

- API: `https://stablebooks-api-production.up.railway.app/api/v1`
- Web: `https://stablebooks-web-production.up.railway.app`
- Infra: Railway staging

## Verification performed

After deploying the Day 23 guardrails, the following checks were run:

- `GET /api/v1/health/storage`
- `corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging`

## Observed storage policy result

Railway staging returned:

- `hostedRuntimePolicy.hostedDetected=true`
- `hostedRuntimePolicy.platform=railway`
- `hostedRuntimePolicy.policyOk=true`
- `hostedRuntimePolicy.allowHostedJsonFallback=false`
- `hostedRuntimePolicy.enforcementEnabled=true`

This confirms the hosted environment is running in the intended strict
Postgres-backed posture without relying on fallback override.

## End-to-end result

Hosted rehearsal still passed successfully.

Example successful hosted outcome:

- invoice: `inv_c8a7c0d156af53d6`
- payment: `pay_0f3e7d610b41666e`
- invoice status: `paid`
- payment status: `finalized`
- match result: `exact`

## Conclusion

Day 23 added hosted fallback guardrails without regressing the Railway staging
runtime.
