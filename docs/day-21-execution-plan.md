# Stablebooks Day 21 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Prisma-backed operator auth runtime`
- Status: `completed`

## Goal

Day 21 moves the remaining high-value operator auth runtime path from the JSON
store toward Prisma-backed storage.

The target is not a giant auth rewrite. The target is the minimum safe cutover
that makes hosted staging operator login and auth context resolution behave
like the rest of the Postgres-backed runtime.

## Planned slices

### Slice 1

Add a Prisma-backed auth repository for:

- users
- sessions
- membership lookup
- organization and wallet auth context hydration

### Slice 2

Move `AuthService` hosted-mode flows to Prisma-backed runtime:

- signup
- signin
- signout
- `getContextFromToken`

### Slice 3

Write organization memberships into Prisma during hosted-mode organization
creation so auth context can resolve organization ownership natively.

### Slice 4

Verify the new auth path through hosted Railway rehearsal.

## Acceptance criteria

Day 21 is complete when:

- hosted-mode auth lifecycle uses Prisma-backed persistence
- session replacement and token lookup no longer depend on the JSON store in
  hosted mode
- membership lookup for auth context is Prisma-backed
- hosted rehearsal still passes end-to-end

## Result

All planned slices were completed and verified on Railway staging.
