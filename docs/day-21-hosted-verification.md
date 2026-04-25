# Stablebooks Day 21 Hosted Verification

## Runtime target

- API: `https://stablebooks-api-production.up.railway.app/api/v1`
- Web: `https://stablebooks-web-production.up.railway.app`
- Infra: Railway staging

## Verification performed

After deploying the Day 21 API changes, the following checks were run:

- `/health/live`
- `/health/storage`
- `corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging`

## Observed result

Hosted rehearsal passed successfully after the auth cutover.

Confirmed:

- operator bootstrap still works
- operator token resolves correctly
- organization creation still works
- membership-backed auth context resolves correctly
- invoice/payment/webhook flow still finalizes correctly
- Web UI remains green on authenticated routes

## Example successful hosted outcome

- invoice: `inv_f330bf5565238bc2`
- payment: `pay_4f9b344c597e9722`
- invoice status: `paid`
- payment status: `finalized`
- match result: `exact`

## Conclusion

Day 21 auth changes are verified against the real hosted staging stack and did
not regress the end-to-end product flow.
