# Stablebooks Day 27 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Production dependency execution prep`
- Status: `accepted`

## Goal

Day 27 turns the Day 26 production launch prep package into executable
dependency packets for real external systems.

This is not a product feature day. It must not change architecture, data
models, runtime behavior, or provider assumptions. It should make the next
external steps concrete enough to execute once access to provider, DNS,
merchant webhook receiver, and ops tooling is available.

## Source baseline

Use these documents as source context:

- `docs/day-26-production-readiness-gaps.md`
- `docs/day-26-railway-production-launch-checklist.md`
- `docs/day-26-real-arc-circle-verification-runbook.md`
- `docs/day-26-outbound-webhook-readiness.md`
- `docs/production-env-checklist.md`
- `docs/production-rollback-strategy.md`

## Scope

Included:

- provider dependency packet
- merchant webhook receiver packet
- production domain and env mapping
- minimum ops baseline
- launch rehearsal worksheet
- Day 27 acceptance note

Excluded:

- new application code
- provider account setup using real credentials
- DNS changes
- production secret values
- merchant receiver implementation
- monitoring vendor integration
- architecture or data model changes

## Planned slices

### Slice 1

Create this execution plan and keep Day 27 constrained to dependency execution
prep.

Status: `complete`.

### Slice 2

Create provider dependency packet:

- required provider account access
- final network/chain details
- final contract/token profile
- webhook callback URLs
- secret placement
- pass/fail evidence required

Status: `complete`.

### Slice 3

Create merchant webhook receiver packet:

- receiver URL requirements
- signing secret handling
- idempotency requirements
- failure/retry/dead-letter test matrix
- replay evidence required

Status: `complete`.

### Slice 4

Create production domain and env mapping:

- API domain
- Web domain
- Railway service variables
- provider callback URL
- public payment page origin
- no-secret placeholder policy

Status: `complete`.

### Slice 5

Create minimum ops baseline and launch rehearsal worksheet:

- health checks
- ownership
- incident triggers
- rollback checkpoints
- single end-to-end launch rehearsal steps

Status: `complete`.

### Slice 6

Create Day 27 acceptance note and update README.

Status: `complete`.

## Acceptance criteria

Day 27 is complete when:

- provider dependency packet exists
- merchant webhook receiver packet exists
- production domain/env mapping exists
- ops baseline and launch rehearsal worksheet exist
- no production secret value is committed
- README points to Day 27 docs

## Decision rule

If a step requires external access or a real secret, document the exact input
and expected output instead of inventing a placeholder result.
