# Stablebooks Day 22 Hosted Bridge Cleanup

## Summary

Day 22 reduced the remaining hosted bridge logic around organization bootstrap.

Before this change, hosted mode still wrote organization, wallet, and customer
records into the JSON store even though the effective runtime path already read
and wrote those domains through Prisma-backed storage.

## What changed

In hosted mode (`STABLEBOOKS_STORAGE_MODE=postgres_reads`):

- organization creation now writes directly to Prisma-backed organization and
  membership storage
- wallet creation now writes directly to Prisma-backed wallet storage
- customer creation now writes directly to Prisma-backed customer storage
- organization onboarding completion now updates Prisma-backed organization
  state without first mutating the JSON store

## What remains true

- JSON storage still exists as fallback behavior for non-Postgres mode
- fallback/local JSON runtime is not removed
- hosted runtime is now cleaner because bootstrap domains no longer dual-write
  into legacy storage

## Why this matters

This reduces confusion and operational risk in hosted staging:

- fewer hidden bridge writes
- less split-brain risk
- clearer separation between hosted runtime and legacy fallback runtime

## Day 22 outcome

Hosted-mode bootstrap is now materially closer to a strict Postgres-backed MVP
runtime.
