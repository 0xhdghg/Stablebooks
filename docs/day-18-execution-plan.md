# Stablebooks Day 18 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Hosted staging deployment prep`
- Status: `completed`

## Goal

Day 18 prepares Stablebooks for the first hosted staging deployment.

The goal is not to deploy blindly. The goal is to define a repeatable staging
shape for Web, API, Postgres, provider webhook ingress, smoke verification, and
rollback so the first hosted run can be executed with low ambiguity.

## Why this matters now

By the end of Day 17, Stablebooks already had:

- a Postgres-backed local production-runtime rehearsal
- a non-dry-run production flow smoke
- a repeatable Web HTTP/SSR smoke gate

The next bottleneck is no longer application code. The next bottleneck is safe
deployment posture:

- where Web and API run
- how Postgres is provisioned
- which secrets must exist
- how operator access is created
- how staging smoke is executed
- how rollback works if the first hosted attempt fails

## Scope

Day 18 covers deployment preparation only.

Included:

- staging target architecture
- staging env and secrets contract
- migration and seed strategy
- operator access strategy
- staging deployment checklist
- staging smoke sequence
- rollback and failure playbook

Excluded:

- actual hosted deployment execution
- real production secret provisioning
- real Arc/Circle staging registration if external account access is still pending
- production observability expansion
- Playwright or richer browser automation

## Target outcome

At the end of Day 18, Stablebooks should have enough written operational
guidance to do the first hosted staging deployment without inventing process in
the middle of the rollout.

## Planned slices

### Slice 1

Create this execution plan and update the repository entry points.

### Slice 2

Define the staging target architecture for:

- Web hosting
- API hosting
- managed Postgres
- Arc/Circle webhook ingress endpoint
- outbound merchant webhook behavior

### Slice 3

Write the staging env and secrets contract, including:

- `DATABASE_URL`
- Postgres-backed runtime flags
- `ARC_WEBHOOK_SECRET`
- provider source profile values
- public API/Web base URLs
- smoke variables

### Slice 4

Define migration, seed, and operator bootstrap strategy:

- how migrations are applied
- whether seed data is used
- how operator auth is created
- how smoke customer and settlement wallet are created

### Slice 5

Create the staging deployment checklist with step-by-step rollout order.

### Slice 6

Create the staging smoke sequence:

- API readiness
- `smoke:production-flow`
- `smoke:production-ui`
- manual sanity checks if needed

### Slice 7

Document rollback and failure handling for the first hosted staging attempt.

### Slice 8

Close Day 18 with an acceptance note and recommend Day 19.

## Acceptance criteria

Day 18 is complete when:

- a clear staging architecture document exists
- required staging env and secret inputs are documented
- migration and operator bootstrap strategy is documented
- a step-by-step staging deployment checklist exists
- a staging smoke sequence exists
- rollback guidance exists for first deployment failures
- README points to the Day 18 documents and next action

## Deliverables

- `docs/day-18-execution-plan.md`
- staging architecture note
- staging env and secrets note
- staging deployment checklist
- staging smoke note
- staging rollback playbook
- `docs/day-18-acceptance-note.md`

## Progress

- Slice 1: completed
- Slice 2: completed
- Slice 3: completed
- Slice 4: completed
- Slice 5: completed
- Slice 6: completed
- Slice 7: completed
- Slice 8: completed

## Immediate next step

Proceed to Day 19:

- execute the first hosted staging rehearsal against real hosted infrastructure
