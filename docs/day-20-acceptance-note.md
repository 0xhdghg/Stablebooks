# Stablebooks Day 20 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 20 is complete.

Stablebooks now has a repeatable hosted staging rehearsal path with materially
less manual operator work.

## What Day 20 achieved

- added hosted bootstrap automation
- added one-command hosted rehearsal automation
- documented the remaining JSON-backed auth/session split
- documented the repeated staging runbook
- fixed a repeated-rehearsal collision caused by reusing the same default
  settlement wallet across multiple organizations

## Practical outcome

The next hosted staging pass no longer needs manual collection of:

- operator token
- customer id
- settlement wallet
- invoice id
- payment id
- public token

## Recommendation for Day 21

The next most valuable step is to reduce the remaining auth/runtime split by
migrating operator auth persistence toward Prisma-backed `users`, `sessions`,
and membership lookup.
