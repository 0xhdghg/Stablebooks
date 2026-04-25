# Stablebooks Day 21 Auth Cutover Note

## Summary

Day 21 introduced a Prisma-backed auth runtime repository and switched hosted
mode auth flows to it.

## What changed

Hosted-mode auth now persists and resolves through Prisma for:

- user creation on signup
- session creation and replacement on signin
- session deletion on signout
- auth token lookup
- membership lookup
- organization and wallet hydration for the operator auth context

## Important implementation detail

No new migration was needed for Day 21.

The Prisma schema already contained:

- `users`
- `sessions`
- `memberships`

The gap was in runtime usage, not schema availability.

## Remaining bridge

The JSON store still exists as a fallback runtime for non-Postgres mode.

That means Day 21 is a hosted-mode cutover, not a total removal of the legacy
store.

## Why this matters

This change removes the most important remaining mismatch between:

- hosted operator authentication
- Postgres-backed payment runtime

The hosted rehearsal path is now much closer to the final MVP runtime shape.
