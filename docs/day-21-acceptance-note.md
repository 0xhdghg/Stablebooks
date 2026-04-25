# Stablebooks Day 21 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 21 is complete.

Stablebooks now uses Prisma-backed operator auth persistence in hosted mode for
the core auth lifecycle:

- signup
- signin
- signout
- token context lookup
- membership-backed organization resolution

## Practical outcome

This materially reduces the remaining JSON/auth split and makes hosted staging
closer to the final MVP runtime posture.

## Recommendation for Day 22

The next valuable step is to keep shrinking bridge logic around hosted mode:

- review whether organization bootstrap still needs JSON mutation in hosted mode
- remove or isolate remaining legacy-store dependencies behind clearer fallback
  boundaries
- decide whether MVP should ship with bridge mode retained or with a stricter
  Postgres-only hosted runtime
