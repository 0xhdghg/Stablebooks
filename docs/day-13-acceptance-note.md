# Stablebooks Day 13 Acceptance Note

## Document status

- Date: `2026-04-22`
- Scope: `Production Arc provider setup and provider boundary`
- Status: `completed`

## Goal

Day 13 moved Stablebooks from Arc-shaped mocks toward a real Arc provider
boundary.

The goal was not to build a full indexer or remove fallback paths. The goal was
to make the real-provider path explicit, safe, documented, and covered by
regression tests before deeper Arc integration work begins.

## Accepted outcome

Stablebooks now has a clear provider ingestion shape:

```text
Arc/Circle provider payload
-> provider decoder boundary
-> canonical Arc event
-> raw evidence ingestion
-> payment matching
-> terminal finality
-> webhook delivery
-> operator visibility
```

## Completed

- Official Arc assumptions were refreshed and documented.
- Webhook-first was selected as the first production-like provider strategy.
- Arc production environment variables and secrets rules were documented.
- Arc readiness output was hardened so it never echoes raw secret values.
- A provider decoder boundary was added.
- Provider responses now expose `providerBoundary`.
- Low-level Circle/Event Monitor payloads with `topics/data` are rejected until
  decoded Transfer args are present.
- Decoded provider-shaped payloads are covered by regression.
- Provider-shaped payloads flow into the same canonical payment pipeline.
- RPC/indexer polling was intentionally deferred.
- Future polling checkpoint/cursor strategy was documented.
- Mock/dev endpoints remain available.
- JSON fallback remains available.

## Key files

- `docs/day-13-provider-assumptions.md`
- `docs/arc-production-setup.md`
- `docs/arc-polling-checkpoint-strategy.md`
- `apps/api/src/modules/arc/arc-provider-decoder.service.ts`
- `apps/api/src/modules/arc/arc-adapter.service.ts`
- `apps/api/scripts/test-arc-regressions.js`

## Verification

The following checks passed:

```text
corepack pnpm --filter @stablebooks/api build
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
corepack pnpm --filter @stablebooks/web typecheck
```

Regression coverage includes:

- sanitized Arc readiness response
- low-level provider payload rejection
- decoded provider-shaped webhook ingestion
- exact payment matching
- Arc finalized path
- Arc failed path
- webhook retry/replay behavior

## Deferred

Deferred intentionally:

- full RPC polling worker
- full indexer polling worker
- provider checkpoint migration
- production deployment
- real secrets
- removing JSON fallback
- removing mock/dev endpoints

## Day 14 recommendation

Recommended Day 14 theme:

- webhook-first production hardening

Recommended next slices:

- add a configurable provider source profile for Circle/Event Monitor payloads
- add stronger decoded payload validation for monitored contract and expected
  token metadata
- add provider observability fields to API/operator surfaces
- add a production-like webhook smoke script with no committed secrets
- keep polling implementation deferred until webhook-first is stable
