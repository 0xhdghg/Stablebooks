# Stablebooks Day 32 Acceptance Note

## Status

Accepted on `2026-04-29`.

## Acceptance statement

Day 32 fixed the hosted Arc payment race where a chain observation can arrive
before the public payment session exists.

After hosted payment-session creation, the API now performs a narrow rematch
pass for already stored detected Arc observations. If exactly one observation
matches the invoice settlement wallet, accepted token, and exact invoice
amount, the existing stored-observation matching path links it to the payment.

If that observation already has `sourceConfirmedAt`, the API immediately uses
the existing Arc-ingestion terminal payment path to finalize the payment and
mark the invoice paid.

## Verification

Local API checks passed:

```text
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
```

The regression suite now includes the timing case:

- invoice is published
- raw Arc observation is ingested before payment session creation
- observation initially remains unmatched
- public payment session is created later
- backend rematches the observation
- payment becomes `finalized`
- invoice becomes `paid`

## Hosted result

Railway API was deployed with:

```text
Deploy Day 32 auto-rematch race fix
```

Hosted race smoke passed:

- invoice `SB-6727DC`
- invoice id `inv_10db16ec28804cea`
- payment id `pay_3b4f5502306cff36`
- public token `pub_74055b753d11db103bca0181`
- payment status `finalized`
- invoice status `paid`
- match result `exact`

No manual observation match or confirmation endpoint was used for the passing
hosted smoke.
