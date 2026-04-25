# Stablebooks Day 20 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Hosted staging repetition hardening`
- Status: `completed`

## Goal

Day 20 turns the first successful hosted rehearsal into a repeatable operating
path.

The main goal is to reduce manual staging work and narrow the remaining runtime
split that still depends on the JSON auth/session store.

## Why this matters now

Day 19 proved that Stablebooks can run as a hosted Railway staging stack.

That was the most important milestone, but the rehearsal still exposed two
practical issues:

- staging bootstrap depended on manual token and ID collection
- operator lifecycle still depends on JSON-backed auth/session state

Day 20 is about making the next hosted rehearsal cheaper, safer, and more
repeatable.

## Scope

Included:

- add bootstrap automation for hosted staging
- make smoke input collection less manual
- document and reduce the remaining auth/runtime JSON split
- prepare cleaner repeated hosted rehearsals

Excluded:

- full production deployment
- external merchant webhook receiver rollout
- full auth migration if it requires a larger storage cutover than Day 20 can
  safely absorb

## Planned slices

### Slice 1

Create this execution plan and update repository entry points.

### Slice 2

Add a hosted staging bootstrap script that can:

- sign up or sign in an operator
- create organization when needed
- create a default settlement wallet
- create a smoke customer
- print the resulting token and IDs in a reusable machine-readable shape

### Slice 3

Document the remaining auth/runtime split:

- users
- sessions
- memberships
- auth context resolution

and define the minimum safe next migration step.

### Slice 4

Add a combined hosted rehearsal helper so the operator can move from bootstrap
output into:

- `smoke:production-flow`
- `smoke:production-ui`

with much less manual copy-paste.

### Slice 5

Capture the updated Day 20 runbook for repeated Railway staging rehearsals.

### Slice 6

Close Day 20 with acceptance note and Day 21 recommendation.

## Acceptance criteria

Day 20 is complete when:

- hosted bootstrap is scriptable
- the smoke flow needs materially less manual input collection
- the remaining auth/runtime split is explicitly documented
- the next hosted rehearsal can be repeated from repo docs and scripts with
  less operator guesswork

## Deliverables

- `docs/day-20-execution-plan.md`
- hosted bootstrap automation script
- auth/runtime split note
- updated repeated-rehearsal runbook
- `docs/day-20-acceptance-note.md`

## Progress

- Slice 1: completed
- Slice 2: completed
- Slice 3: completed
- Slice 4: completed
- Slice 5: completed
- Slice 6: completed
- New script: `corepack pnpm --filter @stablebooks/api bootstrap:hosted-staging`
- New script: `corepack pnpm --filter @stablebooks/api rehearsal:hosted-staging`
- Verified against hosted Railway staging

## Immediate next step

Implement Slice 2: hosted staging bootstrap automation.
