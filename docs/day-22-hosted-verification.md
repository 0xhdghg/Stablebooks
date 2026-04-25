# Stablebooks Day 22 Hosted Verification

## Runtime target

- API: `https://stablebooks-api-production.up.railway.app/api/v1`
- Web: `https://stablebooks-web-production.up.railway.app`
- Infra: Railway staging

## Verification performed

After deploying the Day 22 API changes, the following checks were run:

- `/health/live`
- `/health/storage`
- `corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging`

## Observed result

Hosted rehearsal passed successfully after the bridge cleanup.

Confirmed:

- operator bootstrap still works
- organization bootstrap works without requiring hosted-mode JSON domain writes
- wallet bootstrap works without requiring hosted-mode JSON domain writes
- customer bootstrap works without requiring hosted-mode JSON domain writes
- invoice/payment/webhook flow still finalizes correctly
- Web UI remains green

## Example successful hosted outcome

- invoice: `inv_306e5baabd9b6eae`
- payment: `pay_07e80f871b67ca54`
- invoice status: `paid`
- payment status: `finalized`
- match result: `exact`

## Conclusion

Day 22 reduced bridge logic and preserved the full hosted rehearsal path.
