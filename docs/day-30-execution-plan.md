# Stablebooks Day 30 Execution Plan

## Goal

Fix hosted matching when the same settlement wallet address exists in multiple
organizations.

The Day 29 native Arc USDC replay proved that the API can decode the real Arc
event, but matching stayed `unmatched` because ingestion routed the observation
to the oldest organization with the shared test wallet address. The active
invoice and payment attempt lived in a newer organization using the same
settlement wallet address.

## Scope

- Keep the current webhook ingestion and native Arc decoder unchanged.
- Expand payment candidate lookup to consider all active wallets with the same
  chain/address, not only the first resolved wallet.
- Preserve exact/ambiguous/rejected semantics.
- Do not change schema, UI, auth, or provider configuration.
- Verify by replaying the existing real Arc Testnet transaction after creating
  a payment session.

## Acceptance

- An observation to a duplicated settlement wallet can match an open payment
  attempt in the correct organization.
- Exact amount matching still prevents accidental cross-organization matches.
- If multiple open attempts share the same amount for the same wallet address,
  result remains `ambiguous`.
- Existing API regressions still pass.
