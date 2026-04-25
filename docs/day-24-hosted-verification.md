# Stablebooks Day 24 Hosted Verification

## Runtime target

- API: `https://stablebooks-api-production.up.railway.app/api/v1`
- Web: `https://stablebooks-web-production.up.railway.app`
- Infra: Railway staging

## Verification performed

After deploying the Day 24 readiness changes, the following checks were run:

- `GET /api/v1/health/runtime`
- `corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging`

## Observed runtime summary

`/health/runtime` returned:

- Postgres-backed runtime ready
- hosted runtime policy `policyOk=true`
- Arc webhook source `ready=true`
- outbound webhook mode `disabled`

This matches the intended staging posture.

## End-to-end result

Hosted rehearsal still passed successfully.

Example successful hosted outcome:

- invoice: `inv_e16f6944b8a06219`
- payment: `pay_0ddffa09ad233772`
- invoice status: `paid`
- payment status: `finalized`
- match result: `exact`

## UI result

The operator dashboard now renders the runtime readiness card while the
existing UI smoke remains green.

## Conclusion

Day 24 improved operator readiness visibility without regressing the hosted MVP
path.
