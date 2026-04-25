# Stablebooks Day 23 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Hosted fallback boundary policy`
- Status: `completed`

## Goal

Day 23 defines and enforces how JSON fallback may be used in hosted mode.

The goal is to stop treating hosted JSON fallback as a silent runtime option
and instead make it an explicit emergency override with visible guardrails.

## Decision

Stablebooks will keep JSON fallback available, but:

- normal hosted target posture is Postgres-backed only
- hosted JSON fallback is treated as exceptional rollback behavior
- hosted fallback must be explicitly allowed through
  `STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=true`

## Planned slices

### Slice 1

Audit remaining fallback boundaries and decide the hosted fallback policy.

### Slice 2

Implement a hosted runtime policy service that detects unsafe hosted runtime
fallback posture.

### Slice 3

Expose hosted runtime policy through `/health/storage`.

### Slice 4

Fail hosted startup on unsafe fallback posture unless an explicit override is
set.

### Slice 5

Verify Railway staging still reports healthy hosted policy and passes rehearsal.

## Acceptance criteria

Day 23 is complete when:

- hosted fallback policy is explicit
- `/health/storage` reports hosted runtime policy state
- unsafe hosted fallback is no longer silent
- Railway staging remains green under the intended Postgres-backed posture

## Result

All planned slices were completed and verified on Railway staging.
