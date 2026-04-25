# Stablebooks Day 17 Acceptance Note

## Document status

- Date: `2026-04-23`
- Scope: `Browser smoke automation for production-runtime rehearsal`
- Status: `completed`

## Goal

Day 17 turned the Day 16 manual UI QA into a repeatable smoke gate for the
production-runtime rehearsal.

The goal was not to build a full browser e2e suite. The goal was to add a small,
dependency-free command that verifies rendered Web routes against a running
Postgres-backed API/Web stack before hosted staging.

## Accepted outcome

Stablebooks now has a repeatable Web UI smoke path:

```text
running Postgres-backed API
-> running Web UI
-> smoke-created invoice/payment/webhook IDs
-> env-driven Web smoke command
-> SSR route checks
-> include/exclude assertions
-> machine-readable JSON result
```

## Completed

- Day 17 execution plan was created.
- Current Web tooling was inspected.
- Lightweight HTTP/SSR smoke was selected over Playwright for the first gate.
- Web smoke script was added.
- Smoke script was made env-driven and reusable for local/staging URLs.
- Smoke script avoids printing raw operator token.
- Smoke script supports `--dry-run`.
- Missing env failures return clear messages.
- Web package command was added:
  - `smoke:production-ui`
- Smoke was run against the local Day 16 rehearsal stack.
- Browser smoke result was documented.
- README was updated with Day 17 docs.

## Key files

- `docs/day-17-execution-plan.md`
- `docs/day-17-browser-smoke-results.md`
- `apps/web/scripts/smoke-production-ui.js`
- `apps/web/package.json`

## Verification

Dry-run command passed:

```text
corepack pnpm --filter @stablebooks/web smoke:production-ui -- --dry-run
```

Production UI smoke passed:

```text
corepack pnpm --filter @stablebooks/web smoke:production-ui
```

Smoke result:

```text
ok=true
```

Output log:

```text
day17-production-ui-smoke.out.log
```

## Routes Covered

All covered routes returned `200`:

- `/signin`
- `/dashboard`
- `/invoices/inv_c858e770c99e6168`
- `/payments/pay_9ef0719acf0facca`
- `/webhooks?queue=all`
- `/pay/pub_75edadec50cf2150c7f5f6a3`

## Assertions Covered

Operator UI checks:

- invoice status evidence
- payment status evidence
- provider source evidence
- tx hash evidence
- source confirmation evidence
- webhook delivery evidence

Public hosted page checks:

- payment complete state is visible
- repeat payment action is hidden
- operator diagnostics are not exposed
- tx hash is not exposed

## Deferred

Deferred intentionally:

- Playwright browser automation
- real browser screenshots
- click/form interaction checks
- responsive viewport checks
- cross-browser checks
- hosted staging deployment
- real Circle/Arc webhook registration
- production secret management setup

## Day 18 recommendation

Recommended Day 18 theme:

- hosted staging deployment prep

Recommended slices:

- define staging target architecture for Web, API, Postgres, and provider
  webhook endpoint
- document required staging secrets and safe config
- add staging deploy checklist
- prepare migration/seed/operator access strategy for staging
- define staging smoke sequence:
  - API readiness
  - production flow smoke
  - Web smoke
- document rollback controls for staging
- decide whether outbound merchant webhook remains disabled or points to a
  staging receiver
