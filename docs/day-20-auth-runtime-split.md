# Stablebooks Day 20 Auth Runtime Split Note

## Status

- Date: `2026-04-25`
- Scope: `Remaining JSON/auth split after first hosted staging rehearsal`
- Status: `current`

## Summary

After Day 19, the payment runtime is substantially Postgres-backed, but the
operator auth lifecycle is still centered on the JSON store.

That means hosted staging now works, but auth and organization bootstrap are
still using a bridge posture rather than a single production-shaped source of
truth.

## What is already Postgres-backed

In hosted staging with `STABLEBOOKS_STORAGE_MODE=postgres_reads` and payment
write modes set to `postgres`, the following production-path areas are already
running through Prisma/Postgres:

- invoice creation and reads
- hosted payment-session creation
- raw chain event ingestion
- matching and provider diagnostics
- terminal finalized/failed transitions
- webhook delivery writes and queue reads
- operator-facing invoice/payment/public payment page reads

## What is still JSON-backed

The remaining split is concentrated in auth and operator bootstrap context:

- `users`
- `sessions`
- `memberships`
- primary auth token resolution in `AuthService`
- signup/signin/signout lifecycle

## Current bridge posture

Current hosted behavior works because:

- signup/signin still create JSON users and sessions
- organization creation still creates the JSON membership used by auth context
- Day 19 added Postgres bridging for:
  - organizations
  - wallets
  - customers

This is enough for hosted staging rehearsal, but it is not the final runtime
shape for MVP hardening.

## Risks of leaving it as-is

- auth is not yet aligned with the same source of truth as payment runtime
- operator lifecycle cannot be treated as fully production-shaped
- a future deploy could regress if JSON and Postgres bootstrap drift again
- repeated staging rehearsals still depend on bridge logic rather than native
  auth persistence

## Minimum safe next step

The smallest safe next migration is not a full auth rewrite in one jump.

The recommended next step is:

1. introduce a dedicated auth repository over Prisma for `users`, `sessions`,
   and membership/org lookup
2. move `signup`, `signin`, `signout`, and `getContextFromToken` to that
   repository behind the same hosted staging posture
3. keep the JSON bridge only as fallback until the new auth path is stable

## Why this should be next

This change would:

- eliminate the largest remaining runtime split
- make hosted operator login production-shaped
- remove the need for bootstrap to depend on JSON session state
- make repeated Railway staging rehearsals more trustworthy

## Day 20 recommendation

For Day 20 itself, the goal is not necessarily to finish the whole auth
cutover if it grows too large.

The Day 20 target is to leave the repository with:

- hosted bootstrap automation in place
- the auth split explicitly documented
- a clear next implementation target for auth repository migration
