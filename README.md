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
- [Day 20 plan](/G:/bugbounty/Stablebooks/docs/day-20-execution-plan.md):
  repeated hosted staging hardening for bootstrap automation and remaining
  auth/runtime split reduction.
- [Day 20 auth/runtime split note](/G:/bugbounty/Stablebooks/docs/day-20-auth-runtime-split.md):
  current remaining JSON-backed auth/session posture and the minimum safe next
  migration target.
- [Day 20 repeated staging runbook](/G:/bugbounty/Stablebooks/docs/day-20-repeated-staging-runbook.md):
  lower-touch Railway staging repetition with bootstrap-only and one-command
  hosted rehearsal helpers.
- [Day 20 acceptance](/G:/bugbounty/Stablebooks/docs/day-20-acceptance-note.md):
  accepted repeated staging hardening and full hosted rehearsal automation.
- [Day 21 plan](/G:/bugbounty/Stablebooks/docs/day-21-execution-plan.md):
  Prisma-backed operator auth runtime cutover for hosted mode.
- [Day 21 auth cutover note](/G:/bugbounty/Stablebooks/docs/day-21-auth-cutover-note.md):
  what moved from JSON auth runtime into Prisma-backed persistence.
- [Day 21 hosted verification](/G:/bugbounty/Stablebooks/docs/day-21-hosted-verification.md):
  real Railway verification after the auth cutover.
- [Day 21 acceptance](/G:/bugbounty/Stablebooks/docs/day-21-acceptance-note.md):
  accepted hosted-mode auth persistence migration.
- [Day 22 plan](/G:/bugbounty/Stablebooks/docs/day-22-execution-plan.md):
  hosted bootstrap bridge cleanup for organization, wallet, and customer flows.
- [Day 22 hosted bridge cleanup](/G:/bugbounty/Stablebooks/docs/day-22-hosted-bridge-cleanup.md):
  removal of unnecessary hosted-mode JSON mutation for bootstrap domains.
- [Day 22 hosted verification](/G:/bugbounty/Stablebooks/docs/day-22-hosted-verification.md):
  Railway verification after hosted bootstrap cleanup.
- [Day 22 acceptance](/G:/bugbounty/Stablebooks/docs/day-22-acceptance-note.md):
  accepted hosted bootstrap bridge cleanup.
- [Day 23 plan](/G:/bugbounty/Stablebooks/docs/day-23-execution-plan.md):
  hosted fallback boundary policy and guardrails.
- [Day 23 fallback policy](/G:/bugbounty/Stablebooks/docs/day-23-fallback-policy.md):
  explicit rule that hosted JSON fallback is emergency-only and override-gated.
- [Day 23 hosted verification](/G:/bugbounty/Stablebooks/docs/day-23-hosted-verification.md):
  Railway verification of `hostedRuntimePolicy` and end-to-end rehearsal after
  guardrails.
- [Day 23 acceptance](/G:/bugbounty/Stablebooks/docs/day-23-acceptance-note.md):
  accepted hosted fallback guardrails.
- [Day 24 plan](/G:/bugbounty/Stablebooks/docs/day-24-execution-plan.md):
  operator readiness and observability uplift for the hosted MVP.
- [Day 24 operator readiness](/G:/bugbounty/Stablebooks/docs/day-24-operator-readiness.md):
  new runtime summary endpoint and dashboard runtime card.
- [Day 24 hosted verification](/G:/bugbounty/Stablebooks/docs/day-24-hosted-verification.md):
  Railway verification after the runtime visibility uplift.
- [Day 24 acceptance](/G:/bugbounty/Stablebooks/docs/day-24-acceptance-note.md):
  accepted operator-readiness uplift before MVP sign-off.
- [Day 25 plan](/G:/bugbounty/Stablebooks/docs/day-25-execution-plan.md):
  final MVP sign-off pass.
- [Day 25 hosted verification](/G:/bugbounty/Stablebooks/docs/day-25-hosted-verification.md):
  Railway runtime readiness and canonical hosted rehearsal result.
- [Day 25 MVP sign-off](/G:/bugbounty/Stablebooks/docs/day-25-mvp-signoff.md):
  accepted hosted staging/demo MVP baseline and documented non-blockers.
- [Day 25 acceptance](/G:/bugbounty/Stablebooks/docs/day-25-acceptance-note.md):
  accepted Stablebooks as MVP-ready for staging/demo use.
- [Day 26 plan](/G:/bugbounty/Stablebooks/docs/day-26-execution-plan.md):
  post-MVP production launch prep.
- [Day 26 production readiness gaps](/G:/bugbounty/Stablebooks/docs/day-26-production-readiness-gaps.md):
  production blockers, non-blockers, and external launch dependencies.
- [Day 26 Railway production checklist](/G:/bugbounty/Stablebooks/docs/day-26-railway-production-launch-checklist.md):
  one-stack production launch checklist for API, Web, Postgres, env,
  migrations, smoke, and rollback.
- [Day 26 real Arc/Circle verification runbook](/G:/bugbounty/Stablebooks/docs/day-26-real-arc-circle-verification-runbook.md):
  real provider-delivered payment verification path.
- [Day 26 outbound webhook readiness](/G:/bugbounty/Stablebooks/docs/day-26-outbound-webhook-readiness.md):
  production readiness criteria for merchant webhook delivery, retry,
  dead-letter, and replay.
- [Day 26 acceptance](/G:/bugbounty/Stablebooks/docs/day-26-acceptance-note.md):
  accepted production launch prep package.
- [Day 27 plan](/G:/bugbounty/Stablebooks/docs/day-27-execution-plan.md):
  production dependency execution prep.
- [Day 27 provider dependency packet](/G:/bugbounty/Stablebooks/docs/day-27-provider-dependency-packet.md):
  required provider access, source profile, callback targets, secret placement,
  and pass/fail evidence.
- [Day 27 merchant webhook receiver packet](/G:/bugbounty/Stablebooks/docs/day-27-merchant-webhook-receiver-packet.md):
  receiver requirements, retry/dead-letter/replay matrix, and evidence rules.
- [Day 27 domain/env mapping](/G:/bugbounty/Stablebooks/docs/day-27-domain-env-mapping.md):
  production API/Web origins, Railway env mapping, provider callback URLs, and
  no-go conditions.
- [Day 27 ops baseline and launch rehearsal](/G:/bugbounty/Stablebooks/docs/day-27-ops-baseline-and-launch-rehearsal.md):
  ownership, health checks, rollback checkpoints, and rehearsal worksheet.
- [Day 27 acceptance](/G:/bugbounty/Stablebooks/docs/day-27-acceptance-note.md):
  accepted external dependency execution prep package.
- [Day 28 plan](/G:/bugbounty/Stablebooks/docs/day-28-execution-plan.md):
  Circle-signed webhook ingestion implementation.
- [Day 28 Circle webhook ingestion](/G:/bugbounty/Stablebooks/docs/day-28-circle-webhook-ingestion.md):
  Circle signature verification, test notification acknowledgement, eventLog
  ingestion, and rehearsal compatibility.
- [Day 28 acceptance](/G:/bugbounty/Stablebooks/docs/day-28-acceptance-note.md):
  accepted Circle-signed webhook backend path.
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

1. Treat Railway staging as the canonical MVP runtime baseline.
2. Deploy the Day 28 Circle-signed webhook backend path before switching Circle
   Console away from webhook.site.
3. After deploy, configure Circle API credentials in hosted secrets and run one
   real Arc Testnet USDC transfer through Circle Event Monitoring.
