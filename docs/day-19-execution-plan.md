# Stablebooks Day 19 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `First hosted staging rehearsal`
- Status: `completed`

## Goal

Day 19 executes the first real hosted staging rehearsal for Stablebooks.

The goal is to move from documentation and local rehearsal into an actual
hosted environment:

- hosted Web
- hosted API
- managed Postgres
- staging bootstrap data
- hosted smoke verification

## Why this matters now

By the end of Day 18, Stablebooks already had the full preparation package for
hosted staging:

- staging architecture
- env and secrets contract
- bootstrap strategy
- deployment checklist
- smoke runbook
- failure playbook

The next bottleneck is no longer planning. The next bottleneck is execution
against real hosted infrastructure.

## Scope

Included:

- confirm hosted staging targets
- apply migrations to hosted Postgres
- deploy API with staging env
- deploy Web with staging API base URL
- bootstrap operator/org/wallet/customer
- run hosted staging smoke
- capture rollout result

Excluded:

- full production deployment
- production traffic
- advanced observability rollout
- provider polling modes
- non-essential feature expansion

## Preconditions

Day 19 assumes:

- a hosted Web target is available
- a hosted API target is available
- a managed Postgres target is available
- deployment secret storage is available
- required staging secrets can be set

If those hosted targets do not yet exist, Slice 2 becomes the first practical
blocker.

## Planned slices

### Slice 1

Create this execution plan and update repository entry points.

### Slice 2

Confirm the real hosted staging targets:

- Web URL
- API URL
- managed Postgres target
- provider webhook target
- outbound webhook mode

Current result:

- Railway staging targets were provisioned
- hosted API and Web URLs are live
- managed Postgres is attached

### Slice 3

Apply Prisma migrations to hosted Postgres.

### Slice 4

Deploy API with the Day 18 staging env contract and verify:

- `/api/v1/health/live`
- `/api/v1/health/storage`

### Slice 5

Deploy Web with the correct `API_BASE_URL` and verify `/signin`.

### Slice 6

Bootstrap hosted staging data through API flows:

- operator
- organization
- default settlement wallet
- smoke customer
- fresh operator token

### Slice 7

Run hosted staging smoke:

- `smoke:production-flow`
- `smoke:production-ui`

### Slice 8

Capture the hosted rollout result:

- URLs used
- migration result
- bootstrap result
- smoke result
- issues found

### Slice 9

Close Day 19 with acceptance note and Day 20 recommendation.

## Acceptance criteria

Day 19 is complete when:

- hosted staging targets are confirmed
- migrations are applied successfully to hosted Postgres
- API is live with Postgres-backed readiness green
- Web is live and points to the intended API
- bootstrap data exists in hosted staging
- hosted API smoke passes or failures are captured precisely
- hosted Web smoke passes or failures are captured precisely
- rollout result is documented

## Deliverables

- `docs/day-19-execution-plan.md`
- `docs/day-19-staging-targets-status.md`
- `docs/day-19-railway-provisioning-plan.md`
- hosted staging rollout result note
- `docs/day-19-acceptance-note.md`

## Risk focus

Main Day 19 risks:

- hosted targets are not actually provisioned yet
- wrong env values cause JSON fallback or wrong API wiring
- migrations fail against hosted Postgres
- bootstrap is attempted with destructive local assumptions
- provider/webhook config is incomplete

## Progress

- Slice 1: completed
- Slice 2: completed
- Slice 3: completed
- Slice 4: completed
- Slice 5: completed
- Slice 6: completed
- Slice 7: completed
- Slice 8: completed
- Slice 9: completed
- Hosted staging executed on Railway
- Bootstrap domain writes were bridged to Postgres after the first rehearsal bug

## Immediate next step

Proceed to Day 20: stabilize the hosted staging posture so bootstrap and smoke
can be repeated with less manual setup and less split-brain risk.
