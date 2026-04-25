# Stablebooks Day 14 Acceptance Note

## Document status

- Date: `2026-04-22`
- Scope: `Webhook-first production hardening`
- Status: `completed`

## Goal

Day 14 hardened the Arc webhook-first path so provider payloads are not only
decoded, but checked against an expected provider source profile before they can
reach payment matching.

## Accepted outcome

Stablebooks now has a production-like webhook-first path:

```text
Circle/Event Monitor payload
-> source profile validation
-> provider diagnostics
-> canonical Arc event
-> raw evidence ingestion
-> payment matching
-> operator-visible provider source
```

## Completed

- Provider source profile was added to Arc runtime config.
- Readiness/dev state expose source profile without secrets.
- Webhook mode now requires profile config:
  - `ARC_EVENT_CONTRACT_ADDRESS`
  - `ARC_EVENT_SIGNATURE`
  - `ARC_EVENT_TOKEN_SYMBOL`
  - `ARC_EVENT_TOKEN_DECIMALS`
- Circle/Event Monitor payloads are rejected before matching when profile
  checks fail.
- Safe `rejectedReason` values were added for failed provider validation.
- Provider diagnostics were added to successful Arc responses.
- Provider diagnostics are persisted as safe metadata on Arc-ingested evidence.
- Payment detail API exposes `providerDiagnostic`.
- Invoice detail receives provider diagnostics through latest payment records.
- Operator UI shows provider boundary, source kind, profile match status, and
  warnings.
- Production-like webhook smoke script was added.
- Negative regression coverage was strengthened.
- Full verification passed.

## Key files

- `apps/api/src/modules/arc/arc-config.service.ts`
- `apps/api/src/modules/arc/arc-provider-decoder.service.ts`
- `apps/api/src/modules/arc/arc-adapter.service.ts`
- `apps/api/scripts/test-arc-regressions.js`
- `apps/api/scripts/smoke-arc-webhook.js`
- `apps/web/lib/api.ts`
- `apps/web/app/(app)/payments/[paymentId]/page.tsx`
- `apps/web/app/(app)/invoices/[invoiceId]/page.tsx`
- `docs/arc-production-setup.md`

## Verification

The following checks passed:

```text
corepack pnpm --filter @stablebooks/api build
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
corepack pnpm --filter @stablebooks/web typecheck
```

Smoke dry-run passed:

```text
corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run
```

## Regression coverage

Provider negative coverage now asserts:

- wrong chain id is rejected
- wrong contract address is rejected
- wrong event signature is rejected
- wrong token symbol is rejected
- wrong token decimals are rejected
- missing decoded Transfer args are rejected
- rejected provider payloads do not create raw chain events
- rejected provider payloads do not create chain payment observations

## Deferred

Deferred intentionally:

- real hosted/staging deployment wiring
- real Circle/Arc webhook registration
- live provider secret management
- full RPC/indexer polling worker
- provider checkpoint migration
- removing JSON fallback
- removing mock/dev endpoints

## Day 15 recommendation

Recommended Day 15 theme:

- production storage cutover readiness and deployment smoke

Recommended slices:

- create a production-like env checklist for Postgres-backed runtime flags
- add a local/staging smoke flow that creates invoice -> payment session ->
  provider webhook -> finality -> webhook delivery
- verify UI against Postgres-backed runtime, not JSON fallback
- document rollback strategy for feature flags
- keep real provider registration/manual secrets out of repo
