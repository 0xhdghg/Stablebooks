# Stablebooks Day 14 Execution Plan

## Document status

- Date: `2026-04-22`
- Scope: `Webhook-first production hardening`
- Status: `completed`

## Goal

Day 14 hardens the Arc webhook-first path so provider payloads are no longer
just decoded, but checked against an expected provider source profile.

## Day 14 slices

### Slice 1

Add provider source profile.

Tasks:

- add config fields for the expected Arc/Circle provider stream
- expose the profile in safe readiness/dev state output
- document the env contract
- keep validation enforcement for Slice 2

Expected result:

- backend knows which provider/source/token/event stream is expected

Slice 1 progress:

- provider source profile added to `ArcRuntimeConfig`
- source profile fields:
  - `provider`
  - `eventMonitorSource`
  - `contractAddress`
  - `eventSignature`
  - `tokenSymbol`
  - `tokenDecimals`
- supported provider for this slice:
  - `circle_event_monitor`
- readiness now requires source profile fields in webhook mode:
  - `ARC_EVENT_CONTRACT_ADDRESS`
  - `ARC_EVENT_SIGNATURE`
  - `ARC_EVENT_TOKEN_SYMBOL`
  - `ARC_EVENT_TOKEN_DECIMALS`
- readiness/dev state expose source profile without secrets
- Arc regression runtime now sets a complete provider profile
- Arc regression asserts profile visibility in readiness
- API typecheck remained green
- API regression suite remained green

### Slice 2

Add strong payload validation.

Planned checks:

- reject wrong chain id
- reject wrong contract address
- reject wrong token symbol
- reject wrong decimals
- reject missing decoded Transfer args

Slice 2 progress:

- provider source profile is now enforced for Circle/Event Monitor payloads
- validation happens before canonical payment ingestion
- rejected cases:
  - wrong chain id
  - wrong contract address
  - wrong event signature
  - wrong token symbol
  - wrong token decimals
  - missing decoded Transfer args
- canonical/dev payload shape remains available for existing regression and
  fixture paths
- Arc regression suite now covers negative provider profile cases
- API typecheck remained green
- API regression suite remained green

### Slice 3

Add provider observability in API responses.

Planned output:

- provider boundary kind
- source kind
- source profile matched
- provider warnings
- rejection reason where safe

Slice 3 progress:

- provider observability added to successful Arc provider responses
- success responses now include:
  - `providerBoundary.kind`
  - `providerBoundary.sourceKind`
  - `providerBoundary.sourceProfileMatched`
  - `providerBoundary.providerWarnings`
  - `providerDiagnostic.boundaryKind`
  - `providerDiagnostic.sourceKind`
  - `providerDiagnostic.sourceProfileMatched`
  - `providerDiagnostic.providerWarnings`
  - `providerDiagnostic.rejectedReason`
- Circle/Event Monitor happy path reports:
  - `sourceProfileMatched=true`
- canonical/dev path reports:
  - `sourceProfileMatched=null`
- safe reject responses now include:
  - `rejectedReason`
  - `providerDiagnostic.boundaryKind`
  - `providerDiagnostic.sourceKind`
  - `providerDiagnostic.sourceProfileMatched=false`
- reject responses do not echo secrets or raw provider payloads
- Arc regression suite asserts success and rejection diagnostics
- API typecheck remained green
- API regression suite remained green

### Slice 4

Show provider/source information in operator UI.

Planned surfaces:

- payment detail
- invoice detail timeline
- webhook diagnostics where relevant

Slice 4 progress:

- provider diagnostics are now persisted as safe metadata on Arc-ingested raw
  evidence
- payment serialization exposes `providerDiagnostic`
- invoice detail receives provider diagnostics through latest payment records
- payment detail now shows a `Provider source` card
- invoice detail now shows a `Provider source` card
- UI displays:
  - provider boundary kind
  - source kind
  - profile match status
  - provider warnings
- UI does not read or display raw provider payloads
- Arc regression asserts provider diagnostics reach payment detail API
- API typecheck remained green
- API regression suite remained green
- Web typecheck remained green

### Slice 5

Add production-like webhook smoke script.

Requirements:

- reads secret/config from env
- sends provider-shaped payload
- commits no real secrets

Slice 5 progress:

- production-like Arc webhook smoke script added:
  - `apps/api/scripts/smoke-arc-webhook.js`
- package command added:
  - `corepack pnpm --filter @stablebooks/api smoke:arc-webhook`
- dry-run mode added:
  - `corepack pnpm --filter @stablebooks/api smoke:arc-webhook -- --dry-run`
- script reads from env:
  - `ARC_WEBHOOK_BASE_URL`
  - `ARC_WEBHOOK_SECRET`
  - `ARC_CHAIN_ID`
  - `ARC_EVENT_CONTRACT_ADDRESS`
  - `ARC_EVENT_SIGNATURE`
  - `ARC_EVENT_TOKEN_SYMBOL`
  - `ARC_EVENT_TOKEN_DECIMALS`
  - `ARC_SMOKE_TO`
- optional smoke overrides:
  - `ARC_SMOKE_TX_HASH`
  - `ARC_SMOKE_BLOCK_NUMBER`
  - `ARC_SMOKE_CONFIRMED_AT`
  - `ARC_SMOKE_FROM`
  - `ARC_SMOKE_AMOUNT_ATOMIC`
- script sends a Circle/Event Monitor-style decoded payload to
  `/api/v1/arc/webhooks/events`
- script prints provider diagnostics, match result, and payment status
- no real secrets are committed

### Slice 6

Extend regression coverage.

Negative cases:

- wrong contract
- wrong token
- wrong decimals
- wrong chain id

Slice 6 progress:

- provider negative regression coverage strengthened
- covered rejected cases:
  - wrong chain id
  - wrong contract address
  - wrong event signature
  - wrong token symbol
  - wrong token decimals
  - missing decoded Transfer args
- tests now assert exact machine-readable `rejectedReason` values:
  - `chain_id_mismatch`
  - `contract_address_mismatch`
  - `event_signature_mismatch`
  - `token_symbol_mismatch`
  - `token_decimals_mismatch`
  - `missing_decoded_transfer_args`
- tests verify rejected provider payloads do not create:
  - raw chain events
  - chain payment observations
- API typecheck remained green
- API regression suite remained green

### Slice 7

Run full verification.

Required checks:

- `corepack pnpm --filter @stablebooks/api build`
- `corepack pnpm --filter @stablebooks/api typecheck`
- `corepack pnpm --filter @stablebooks/api test`
- `corepack pnpm --filter @stablebooks/web typecheck`

Slice 7 progress:

- full verification completed
- checks passed:
  - `corepack pnpm --filter @stablebooks/api build`
  - `corepack pnpm --filter @stablebooks/api typecheck`
  - `corepack pnpm --filter @stablebooks/api test`
  - `corepack pnpm --filter @stablebooks/web typecheck`
- Arc regression suite remained green
- webhook retry/replay regression suite remained green
- provider profile negative coverage remained green
- operator UI typecheck remained green

### Slice 8

Close Day 14.

Expected result:

- `docs/day-14-acceptance-note.md`
- README updated
- Day 15 recommendation captured

Slice 8 progress:

- Day 14 acceptance note written:
  - `docs/day-14-acceptance-note.md`
- this execution plan marked `completed`
- README updated with Day 14 acceptance
- Day 15 recommendation captured:
  - production storage cutover readiness and deployment smoke
