# Stablebooks

Stablebooks is an Arc-native stablecoin receivables and treasury automation product.

This repository is organized as a small monorepo so the product can evolve with a shared source of truth across:

- `apps/web` for the frontend application
- `apps/api` for the backend API and worker-ready service
- `docs` for product, UX, and engineering specs

## Repository layout

```text
Stablebooks/
  apps/
    api/
    web/
  docs/
    product/
    repo_bootstrap_plan.md
  packages/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

## Current status

The repo has moved past scaffold into a runnable MVP foundation:

- Next.js operator UI
- NestJS API
- Prisma/Postgres schema and seed
- JSON fallback runtime
- Arc-shaped payment observation/finality mocks
- webhook delivery retry/replay paths
- first controlled Postgres write path for invoice creation
- Postgres-backed hosted payment-session creation behind a feature flag
- Postgres-backed raw chain ingestion and matching behind a feature flag
- Postgres-backed terminal payment transitions behind a feature flag
- Postgres-backed webhook delivery writes behind a feature flag

Product and engineering documentation lives in [docs/product](/G:/bugbounty/Stablebooks/docs/product).

Recent engineering checkpoints:

- [Day 6 acceptance](/G:/bugbounty/Stablebooks/docs/day-6-acceptance-note.md):
  first Postgres-backed runtime reads.
- [Day 7 acceptance](/G:/bugbounty/Stablebooks/docs/day-7-acceptance-note.md):
  first Postgres-backed invoice write path behind
  `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`.
- [Day 8 acceptance](/G:/bugbounty/Stablebooks/docs/day-8-acceptance-note.md):
  hosted payment-session creation through Prisma behind
  `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`.
- [Day 9 plan](/G:/bugbounty/Stablebooks/docs/day-9-execution-plan.md):
  matching writes through Prisma behind
  `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`.
- [Day 9 acceptance](/G:/bugbounty/Stablebooks/docs/day-9-acceptance-note.md):
  raw chain event ingestion and exact matching through Prisma.
- [Day 10 plan](/G:/bugbounty/Stablebooks/docs/day-10-execution-plan.md):
  terminal finalized/failed transitions through Prisma behind
  `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`.
- [Day 10 acceptance](/G:/bugbounty/Stablebooks/docs/day-10-acceptance-note.md):
  terminal finalized/failed payment transitions through Prisma.
- [Day 11 plan](/G:/bugbounty/Stablebooks/docs/day-11-execution-plan.md):
  webhook delivery writes through Prisma behind
  `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`.
- [Day 11 acceptance](/G:/bugbounty/Stablebooks/docs/day-11-acceptance-note.md):
  webhook delivery creation, retry, replay, and operator queue reads through
  Prisma.
- [Day 12 plan](/G:/bugbounty/Stablebooks/docs/day-12-execution-plan.md):
  production hardening before production Arc provider setup.
- [Day 12 acceptance](/G:/bugbounty/Stablebooks/docs/day-12-acceptance-note.md):
  idempotency, webhook failure, dead-letter, retry/replay, and operator
  diagnostics hardening.
- [Day 13 plan](/G:/bugbounty/Stablebooks/docs/day-13-execution-plan.md):
  production Arc provider setup plan and provider boundary definition.
- [Day 13 acceptance](/G:/bugbounty/Stablebooks/docs/day-13-acceptance-note.md):
  Arc provider boundary, webhook-first env contract, provider-shaped
  regression, and polling checkpoint strategy.
- [Day 14 plan](/G:/bugbounty/Stablebooks/docs/day-14-execution-plan.md):
  webhook-first production hardening with provider source profile and stronger
  payload validation.
- [Day 14 acceptance](/G:/bugbounty/Stablebooks/docs/day-14-acceptance-note.md):
  provider source profile enforcement, safe diagnostics, operator visibility,
  webhook smoke script, and strengthened negative regression coverage.
- [Day 15 plan](/G:/bugbounty/Stablebooks/docs/day-15-execution-plan.md):
  production storage cutover readiness and deployment smoke.
- [Day 15 acceptance](/G:/bugbounty/Stablebooks/docs/day-15-acceptance-note.md):
  production-like Postgres runtime readiness, smoke dry-runs, rollback posture,
  and no-leak audit.
- [Day 16 plan](/G:/bugbounty/Stablebooks/docs/day-16-execution-plan.md):
  staging/local production-runtime rehearsal.
- [Day 16 rehearsal runbook](/G:/bugbounty/Stablebooks/docs/day-16-rehearsal-runbook.md):
  exact local commands for Postgres-backed API/Web startup, non-dry-run smoke,
  and operator UI verification.
- [Day 16 rehearsal results](/G:/bugbounty/Stablebooks/docs/day-16-rehearsal-results.md):
  local production-runtime rehearsal output, UI QA result, issues found, and
  fixes applied.
- [Day 16 acceptance](/G:/bugbounty/Stablebooks/docs/day-16-acceptance-note.md):
  accepted local production-runtime rehearsal with non-dry-run smoke and UI QA.
- [Day 17 plan](/G:/bugbounty/Stablebooks/docs/day-17-execution-plan.md):
  browser smoke automation plan for the production-runtime rehearsal.
- [Day 17 browser smoke results](/G:/bugbounty/Stablebooks/docs/day-17-browser-smoke-results.md):
  first automated Web HTTP/SSR smoke result for production-runtime UI routes.
- [Day 17 acceptance](/G:/bugbounty/Stablebooks/docs/day-17-acceptance-note.md):
  accepted Web smoke automation gate for the production-runtime rehearsal.
- [Day 18 plan](/G:/bugbounty/Stablebooks/docs/day-18-execution-plan.md):
  hosted staging deployment prep plan for architecture, config, smoke, and
  rollback.
- [Day 18 staging architecture](/G:/bugbounty/Stablebooks/docs/day-18-staging-architecture.md):
  target hosted topology for Web, API, Postgres, Arc webhook ingress, and
  outbound webhook behavior.
- [Day 18 staging env contract](/G:/bugbounty/Stablebooks/docs/day-18-staging-env-contract.md):
  exact hosted staging variables split into secrets, safe config, smoke-only,
  and local/dev-only values.
- [Day 18 staging bootstrap strategy](/G:/bugbounty/Stablebooks/docs/day-18-staging-bootstrap-strategy.md):
  migration policy, non-destructive staging bootstrap path, operator creation,
  settlement wallet setup, and smoke customer setup.
- [Day 18 staging deployment checklist](/G:/bugbounty/Stablebooks/docs/day-18-staging-deployment-checklist.md):
  rollout order for hosted staging: infra, config, migrations, deploy,
  bootstrap, smoke, and sign-off.
- [Day 18 staging smoke runbook](/G:/bugbounty/Stablebooks/docs/day-18-staging-smoke-runbook.md):
  hosted staging verification sequence for readiness, API flow smoke, Web UI
  smoke, and manual sanity checks.
- [Day 18 staging failure playbook](/G:/bugbounty/Stablebooks/docs/day-18-staging-failure-playbook.md):
  first-hosted-staging rollback and failure handling for migrations, runtime
  config, provider ingress, Web routing, and outbound webhooks.
- [Day 18 acceptance](/G:/bugbounty/Stablebooks/docs/day-18-acceptance-note.md):
  accepted hosted staging deployment prep package for architecture, config,
  bootstrap, smoke, and rollback.
- [Day 19 plan](/G:/bugbounty/Stablebooks/docs/day-19-execution-plan.md):
  first hosted staging rehearsal plan for targets, deploy, bootstrap, smoke,
  and rollout result capture.
- [Day 19 staging targets status](/G:/bugbounty/Stablebooks/docs/day-19-staging-targets-status.md):
  confirmed Railway hosted Web/API/Postgres targets used for the first staging
  rehearsal.
- [Day 19 Railway provisioning plan](/G:/bugbounty/Stablebooks/docs/day-19-railway-provisioning-plan.md):
  concrete one-stack hosted staging plan using Railway for Web, API, and
  Postgres.
- [Day 19 hosted rehearsal results](/G:/bugbounty/Stablebooks/docs/day-19-hosted-rehearsal-results.md):
  first successful hosted staging deploy, bootstrap, API smoke, Web smoke, and
  the split-brain bootstrap bug fixed during rehearsal.
- [Day 19 acceptance](/G:/bugbounty/Stablebooks/docs/day-19-acceptance-note.md):
  accepted first hosted staging rehearsal on Railway.
- [Production env checklist](/G:/bugbounty/Stablebooks/docs/production-env-checklist.md):
  Postgres-backed runtime, Arc webhook-first config, outbound webhook config,
  smoke variables, and no-commit rules.
- [Postgres UI smoke](/G:/bugbounty/Stablebooks/docs/postgres-ui-smoke.md):
  manual operator UI smoke checklist for Postgres-backed runtime.
- [Production rollback strategy](/G:/bugbounty/Stablebooks/docs/production-rollback-strategy.md):
  safe feature-flag rollback levels for provider ingestion, webhooks, and
  Postgres-backed runtime.
- [Day 15 secrets/no-leak audit](/G:/bugbounty/Stablebooks/docs/day-15-secrets-no-leak-audit.md):
  repository audit for placeholders, smoke secrets, readiness redaction, and
  local-only env posture.
- [Arc production setup](/G:/bugbounty/Stablebooks/docs/arc-production-setup.md):
  environment contract for webhook-first Arc provider ingestion.
- [Arc polling checkpoint strategy](/G:/bugbounty/Stablebooks/docs/arc-polling-checkpoint-strategy.md):
  future RPC/indexer cursor model for safe polling modes.

## Next build steps

1. Start Day 20: reduce manual staging setup and harden repeated hosted rehearsals.
2. Automate staging bootstrap and smoke input collection.
3. Reduce remaining JSON/auth split where it affects hosted operator lifecycle.
