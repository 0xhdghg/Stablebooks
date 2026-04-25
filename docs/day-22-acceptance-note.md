# Stablebooks Day 22 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 22 is complete.

Stablebooks hosted mode now avoids unnecessary JSON-store mutation for the main
bootstrap domains:

- organizations
- wallets
- customers

## Practical outcome

This makes hosted staging cleaner and easier to reason about because the
effective hosted runtime is now closer to a true Postgres-backed path instead
of a dual-write bridge.

## Recommendation for Day 23

The next valuable step is to audit the remaining fallback boundaries and decide
how strict MVP should be about hosted-mode rollback:

- keep JSON fallback only for local/dev
- or preserve a limited hosted rollback path with very explicit guardrails
