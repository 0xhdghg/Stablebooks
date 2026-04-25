# Stablebooks Day 13 Execution Plan

## Document status

- Date: `2026-04-21`
- Scope: `Production Arc provider setup plan`
- Status: `completed`

## Goal

Day 13 starts the move from Arc-shaped mocks to a real Arc provider boundary.

The goal is not to remove mocks or JSON fallback. The goal is to define and
implement a safe provider layer so Stablebooks can ingest real Arc evidence
without destabilizing the Postgres-backed payment runtime completed through Day
12.

## Product outcome

By the end of Day 13, Stablebooks should have a clear answer to:

> How does a real Arc event enter our system, become canonical payment evidence,
> and move through the same Postgres matching/finality/webhook pipeline that our
> mocks already prove?

## Current starting point

Already available:

- `ArcConfigService`
- `ArcAdapterService`
- Arc readiness endpoints
- Arc dev ingest endpoint
- Arc webhook event endpoint
- Arc webhook finality endpoint
- Arc event normalizer
- Arc fixtures
- Postgres raw chain ingestion
- Postgres matching
- Postgres terminal finality
- Postgres webhook delivery writes
- retry/replay/dead-letter hardening

Missing:

- real provider adapter boundary
- production env contract documentation
- real RPC/indexer polling implementation
- safe cursor/checkpoint strategy
- provider error handling and observability contract
- integration smoke that proves provider payloads enter the same canonical path

## Day 13 scope

Day 13 includes:

- official Arc/Circle source refresh before coding provider assumptions
- environment variable contract for Arc production setup
- provider adapter interface
- provider mode decision:
  - webhook-first
  - rpc polling later
  - indexer polling later if needed
- readiness hardening
- provider payload normalization contract
- provider ingestion smoke using the same canonical flow
- docs for how to switch from mocks to Arc safely

Day 13 does not include:

- removing mock endpoints
- removing JSON fallback
- deploying to production
- committing real secrets
- building a full indexer
- partial payment/overpayment accounting
- merchant-managed webhook endpoint UI

## Recommended provider strategy

Recommended first production strategy:

- webhook-first Arc ingestion

Reason:

- it fits the existing `POST /api/v1/arc/webhooks/events` and
  `POST /api/v1/arc/webhooks/finality` shape
- it avoids building a fragile polling/indexer loop too early
- it keeps finality events explicit
- it lets Stablebooks reuse the hardened Day 12 payment/webhook runtime

RPC/indexer polling should stay behind a separate adapter boundary until the
webhook path is proven.

## Environment contract draft

Required for all production Arc modes:

- `ARC_SOURCE_ENABLED=true`
- `ARC_SOURCE_KIND=webhook | rpc_polling | indexer_polling`
- `ARC_CHAIN_ID`

Webhook mode:

- `ARC_WEBHOOK_SECRET`

RPC polling mode:

- `ARC_RPC_URL`
- `ARC_START_BLOCK`
- `ARC_POLL_INTERVAL_MS`
- `ARC_CONFIRMATIONS_REQUIRED`

Stablebooks runtime flags to preserve:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- `STABLEBOOKS_INVOICE_WRITE_MODE=postgres`
- `STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres`
- `STABLEBOOKS_MATCHING_WRITE_MODE=postgres`
- `STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres`
- `STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres`

Secrets rule:

- never commit real `ARC_RPC_URL`, webhook secrets, private keys, or merchant
  webhook secrets

## Acceptance criteria

Day 13 is complete when:

- [x] docs capture the real Arc provider boundary
- [x] env contract is documented
- [x] current Arc config/readiness behavior is verified
- [x] webhook-first production mode is explicitly chosen or rejected
- [x] provider adapter interface exists if code changes are made
- [x] provider payload normalization is covered by regression
- [x] provider ingestion still routes into canonical Postgres flow
- [x] polling checkpoint strategy is documented
- [x] mock/dev endpoints remain available
- [x] JSON fallback remains available
- [x] API build/typecheck/test remain green
- [x] Day 13 acceptance note is written

## Implementation slices

### Slice 1

Refresh and freeze provider assumptions.

Tasks:

- review the current Arc module
- review official Arc/Circle docs before relying on production specifics
- document which fields are required from real provider events
- document what remains an assumption

Expected result:

- short provider assumptions note in `docs/`
- no code changes unless a tiny naming mismatch is obvious

Slice 1 progress:

- current Arc module reviewed:
  - `ArcConfigService`
  - `ArcAdapterService`
  - `ArcEventNormalizerService`
  - Arc readiness/dev/webhook endpoints
- official Arc docs refreshed:
  - Arc network overview
  - Connect to Arc
  - Node providers
  - Monitor contract events
- provider assumptions documented in:
  - `docs/day-13-provider-assumptions.md`
- frozen current Arc testnet assumptions:
  - chain id `5042002`
  - HTTP RPC `https://rpc.testnet.arc.network`
  - WebSocket `wss://rpc.testnet.arc.network`
  - gas token `USDC`
  - deterministic sub-second finality
- recommended provider strategy confirmed:
  - webhook-first through Circle/Arc event monitor style payloads
  - RPC/indexer polling remains future adapter work
- main mismatch identified:
  - current normalizer accepts friendly canonical fields
  - real event monitor payloads can arrive as event logs with topics/data
  - a provider-specific decoder is needed before canonical payment ingestion

### Slice 2

Document the production Arc env contract.

Tasks:

- define required env vars by source mode
- define safe local defaults
- define missing-config readiness behavior
- define which values are secrets

Expected result:

- `docs/arc-production-setup.md`
- README points to the setup doc

Slice 2 progress:

- Arc production env contract documented in:
  - `docs/arc-production-setup.md`
- README now links to the Arc production setup doc
- webhook-first mode documented as the recommended first production-like mode
- polling modes documented as future adapter modes
- required env vars documented:
  - `ARC_SOURCE_ENABLED`
  - `ARC_SOURCE_KIND`
  - `ARC_CHAIN_ID`
  - `ARC_WEBHOOK_SECRET`
  - `ARC_RPC_URL`
  - `ARC_START_BLOCK`
  - `ARC_POLL_INTERVAL_MS`
  - `ARC_CONFIRMATIONS_REQUIRED`
- future provider decoder vars reserved:
  - `ARC_EVENT_MONITOR_SOURCE`
  - `ARC_EVENT_CONTRACT_ADDRESS`
  - `ARC_EVENT_SIGNATURE`
  - `ARC_EVENT_TOKEN_SYMBOL`
  - `ARC_EVENT_TOKEN_DECIMALS`
- secrets policy documented
- readiness behavior documented
- Slice 3 target identified:
  - sanitize readiness output so it never echoes `rpcUrl` or `webhookSecret`

### Slice 3

Harden Arc readiness output.

Tasks:

- verify readiness reports missing `ARC_CHAIN_ID`
- verify readiness reports missing `ARC_RPC_URL` for polling modes
- verify readiness reports missing `ARC_WEBHOOK_SECRET` for webhook mode
- make readiness output operator-safe:
  - show booleans for secret presence
  - never echo secret values

Expected result:

- readiness behavior is documented and tested/smoked

Slice 3 progress:

- Arc readiness output hardened
- readiness now returns a sanitized config view:
  - `enabled`
  - `sourceKind`
  - `chainId`
  - `pollIntervalMs`
  - `confirmationsRequired`
  - `startBlock`
  - `hasRpcUrl`
  - `hasWebhookSecret`
- readiness no longer returns raw:
  - `rpcUrl`
  - `webhookSecret`
- Arc dev state still exposes safe booleans for operator debugging
- Arc regression now asserts:
  - readiness is ready in webhook mode
  - `hasWebhookSecret = true`
  - `hasRpcUrl = false`
  - `webhookSecret` is absent from readiness config
  - `rpcUrl` is absent from readiness config
- API typecheck remained green
- API regression suite remained green

### Slice 4

Create provider adapter boundary.

Tasks:

- introduce a small provider adapter interface if useful
- keep existing normalizer as canonical boundary
- make webhook provider path explicit
- leave rpc/indexer polling as stubs or documented future modes if not ready

Expected result:

- provider-specific ingestion does not leak into payments service
- mocks/dev fixtures still route through canonical events

Slice 4 progress:

- provider adapter boundary added in:
  - `ArcProviderDecoderService`
- `ArcAdapterService` no longer sends provider payloads directly to payments
  runtime
- webhook/dev provider ingestion now flows through:
  - provider decoder
  - canonical Arc event normalizer
  - existing payments ingestion pipeline
- adapter responses now expose `providerBoundary`
- supported boundary kinds:
  - `canonical`
  - `circle_event_monitor`
- low-level Circle/Event Monitor payloads with `topics/data` are explicitly
  rejected until decoded Transfer args are present
- this protects matching from accidentally accepting raw provider logs as
  canonical payments
- fixtures remain routed through canonical events
- API typecheck remained green
- API regression suite remained green

### Slice 5

Add provider payload regression.

Tasks:

- add a regression that sends a provider-shaped event through Arc webhook/dev
  endpoint
- verify raw event ingestion
- verify exact matching
- verify finality
- verify webhook delivery creation

Expected result:

- provider payload shape is protected by automated test

Slice 5 progress:

- Arc regression suite now includes a decoded provider-shaped webhook payload
- covered provider shape:
  - Circle/Event Monitor-style `notification`
  - `blockchain`
  - `contractAddress`
  - `topics`
  - `data`
  - decoded Transfer args
- regression verifies:
  - provider boundary kind is `circle_event_monitor`
  - decoded provider payload becomes canonical Arc event
  - raw evidence mirror is created
  - payment matches invoice exactly
  - payment moves to `processing`
  - Arc finality moves payment to `finalized`
  - invoice moves to `paid`
  - `sourceConfirmedAt` is updated from finality
  - `payment.finalized` webhook delivery is created
- low-level provider payload without decoded Transfer args remains rejected
- tx hashes are now named constants so test order cannot accidentally change
  scenario identity
- API typecheck remained green
- API regression suite remained green

### Slice 6

Define checkpoint/cursor strategy for polling modes.

Tasks:

- decide where `lastProcessedBlock` would live
- define rollback/reorg handling assumptions
- define confirmation window behavior
- keep implementation deferred unless tiny and safe

Expected result:

- polling modes have a design path without being half-built

Slice 6 progress:

- polling checkpoint strategy documented in:
  - `docs/arc-polling-checkpoint-strategy.md`
- decision confirmed:
  - no polling worker implementation in Day 13
  - no unused cursor migration in Day 13
- future durable table proposed:
  - `provider_checkpoints`
- cursor identity scoped by:
  - provider
  - source kind
  - chain id
  - contract address
  - event signature
- idempotency remains anchored on:
  - `unique(chain_id, tx_hash, log_index)`
- Arc confirmation guidance documented:
  - start with `ARC_CONFIRMATIONS_REQUIRED=1`
  - keep confirmation window configurable for provider lag/future modes
- rollback/reorg stance documented:
  - do not delete raw evidence automatically
  - use explicit compensating events/reconciliation if ever needed
- `docs/arc-production-setup.md` now links polling modes to the checkpoint
  strategy

### Slice 7

Run full verification.

Required checks:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- `corepack pnpm --filter @stablebooks/web typecheck`

Expected result:

- all checks green
- Arc regressions remain green
- webhook regressions remain green

Slice 7 progress:

- full verification completed
- checks passed:
  - `corepack pnpm --filter @stablebooks/api build`
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`
  - `corepack pnpm --filter @stablebooks/web typecheck`
- Arc regression suite remained green
- webhook retry/replay regression suite remained green
- mock/dev endpoints remain covered by the Arc regression suite:
  - readiness endpoint
  - evidence store endpoint
  - provider webhook endpoint
  - finality webhook endpoint
- JSON fallback remains available in the regression runtime:
  - `STABLEBOOKS_STORAGE_MODE=json`
  - Postgres evidence mirror runs in `postgres_shadow`

### Slice 8

Close Day 13.

Expected result:

- `docs/day-13-acceptance-note.md`
- this plan marked `completed`
- README updated with Day 13 acceptance
- next day recommendation captured

Slice 8 progress:

- Day 13 acceptance note written:
  - `docs/day-13-acceptance-note.md`
- this execution plan marked `completed`
- README updated with Day 13 acceptance
- Day 14 recommendation captured:
  - webhook-first production hardening
  - stronger provider source validation
  - production-like webhook smoke without committed secrets

## Recommended next day after Day 13

If Day 13 is clean, recommended Day 14 theme:

- implement the first real Arc ingestion mode
- likely webhook-first production mode
- keep RPC/indexer polling behind a separate future boundary
- add production-like smoke with real provider-shaped payloads and no secrets in
  repo
