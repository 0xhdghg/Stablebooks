# Stablebooks Day 26 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Post-MVP production launch prep`
- Status: `accepted`

## Goal

Day 26 converts the Day 25 MVP-ready hosted staging baseline into a concrete
production launch prep package.

This is not a feature day. It must not add product behavior or change
architecture. It should identify the exact remaining production readiness gaps
and define the safe path from hosted staging to real launch.

## Source baseline

Use these documents as source context:

- `docs/day-25-mvp-signoff.md`
- `docs/day-25-hosted-verification.md`
- `docs/production-env-checklist.md`
- `docs/production-rollback-strategy.md`
- `docs/arc-production-setup.md`

## Scope

Included:

- production readiness gap inventory
- one-stack production launch checklist
- real Arc/Circle verification runbook
- outbound merchant webhook readiness criteria
- security and operations sign-off checklist
- Day 26 acceptance note

Excluded:

- new features
- architecture changes
- data model changes
- dependency changes
- production secret values
- real provider credential rotation
- real domain/DNS changes

## Planned slices

### Slice 1

Create this execution plan and constrain Day 26 to production launch prep.

Status: `complete`.

### Slice 2

Create a production readiness gap inventory:

- what is already MVP-ready
- what is required before real production
- what is intentionally post-launch
- which gaps are blockers vs non-blockers

Status: `complete`.

### Slice 3

Create a one-stack production launch checklist for Railway:

- API service
- Web service
- Postgres
- env/secrets
- migrations
- runtime readiness
- rollback posture

Status: `complete`.

### Slice 4

Create a real Arc/Circle verification runbook:

- provider/event monitor setup
- monitored contract/token profile
- webhook URL and secret setup
- real transaction verification
- expected UI/operator evidence

Status: `complete`.

### Slice 5

Create outbound merchant webhook readiness criteria:

- destination URL
- signing secret
- retry/dead-letter verification
- replay policy
- operator visibility

Status: `complete`.

### Slice 6

Create Day 26 acceptance note and update README.

Status: `complete`.

## Acceptance criteria

Day 26 is complete when:

- production readiness gaps are documented
- production launch checklist exists
- real Arc/Circle verification runbook exists
- outbound merchant webhook readiness criteria are documented
- no production secret value is committed
- README points to the Day 26 production launch prep docs

## Decision rule

If a gap requires real external credentials, DNS, provider access, or merchant
infrastructure, document it as an external launch dependency rather than
mocking or bypassing it in code.
