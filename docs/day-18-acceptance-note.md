# Stablebooks Day 18 Acceptance Note

## Document status

- Date: `2026-04-25`
- Scope: `Hosted staging deployment prep`
- Status: `completed`

## Goal

Day 18 prepared Stablebooks for the first hosted staging deployment.

The goal was not to deploy yet. The goal was to remove ambiguity before that
deployment by fixing the operational shape:

- target staging architecture
- env and secrets contract
- migration and bootstrap strategy
- rollout checklist
- smoke runbook
- failure and rollback playbook

## Accepted outcome

Stablebooks now has a complete hosted staging preparation package:

```text
staging architecture defined
-> staging env/secrets contract documented
-> migration/bootstrap policy documented
-> deployment checklist documented
-> staging smoke runbook documented
-> failure/rollback playbook documented
```

This means the next step is no longer planning. The next step is executing the
first hosted staging rehearsal against a real hosted Web/API/Postgres setup.

## Completed

- Day 18 execution plan was created.
- Hosted staging target architecture was documented.
- Hosted staging env/secrets contract was documented.
- Migration and bootstrap strategy was documented.
- Step-by-step staging deployment checklist was documented.
- Hosted staging smoke runbook was documented.
- First-hosted-staging failure playbook was documented.
- README was updated with all Day 18 operational docs.

## Key files

- `docs/day-18-execution-plan.md`
- `docs/day-18-staging-architecture.md`
- `docs/day-18-staging-env-contract.md`
- `docs/day-18-staging-bootstrap-strategy.md`
- `docs/day-18-staging-deployment-checklist.md`
- `docs/day-18-staging-smoke-runbook.md`
- `docs/day-18-staging-failure-playbook.md`

## Acceptance criteria result

All Day 18 acceptance criteria are met:

- staging architecture exists
- staging env and secret inputs are documented
- migration and operator bootstrap strategy exists
- step-by-step deployment checklist exists
- staging smoke sequence exists
- rollback guidance exists
- README points to Day 18 docs and next action

## Deferred intentionally

Still deferred after Day 18:

- actual hosted staging deployment execution
- real provider webhook registration if external access is still pending
- staging rollout result capture
- post-staging fixes from live hosted findings

## Day 19 recommendation

Recommended Day 19 theme:

- first hosted staging rehearsal

Recommended slices:

- provision/confirm hosted staging targets
- apply migrations to hosted Postgres
- deploy API with staging env
- deploy Web with staging API base URL
- bootstrap operator/org/wallet/customer
- run hosted staging smoke
- capture rollout result and issues
