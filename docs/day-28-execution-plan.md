# Stablebooks Day 28 Execution Plan

## Document status

- Date: `2026-04-25`
- Scope: `Circle-signed webhook ingestion`
- Status: `accepted`

## Goal

Day 28 makes Stablebooks able to receive real Circle webhook notifications from
the Arc Testnet USDC `Transfer` subscription created during Day 27 exploration.

This is a narrow implementation day. It must not change the payment matching
model, database schema, UI, or hosted runtime architecture.

## Source baseline

Use these documents and verified console facts as source context:

- `docs/day-27-provider-dependency-packet.md`
- `docs/day-27-domain-env-mapping.md`
- `docs/day-27-ops-baseline-and-launch-rehearsal.md`
- Circle webhook test delivery observed on `2026-04-25`
- Circle headers observed:
  - `x-circle-key-id`
  - `x-circle-signature`
- Circle test payload observed:
  - `notificationType=webhooks.test`
- Circle subscription created:
  - network: `Arc Testnet`
  - contract: `0x3600000000000000000000000000000000000000`
  - event: `Transfer`

## Scope

Included:

- Circle webhook signature verification support
- Circle `webhooks.test` safe acknowledgement
- Circle `contracts.eventLog` ingestion through the existing provider decoder
- compatibility with existing `x-arc-webhook-secret` rehearsal path
- regression coverage
- Day 28 docs and README update

Excluded:

- new dependencies
- data model changes
- UI changes
- Circle API key storage
- real production DNS changes
- replacing webhook.site in Circle Console
- real Arc transfer execution

## Planned slices

### Slice 1

Create this execution plan and constrain Day 28 to Circle-signed webhook
ingestion.

Status: `complete`.

### Slice 2

Add Circle webhook verification support:

- read `x-circle-key-id`
- read `x-circle-signature`
- fetch Circle public key by key id
- verify signature against the raw request body
- fail closed for invalid signatures

Status: `complete`.

### Slice 3

Preserve the existing rehearsal auth path:

- keep `x-arc-webhook-secret`
- keep hosted rehearsal behavior unchanged
- only use Circle signature path when Circle headers are present

Status: `complete`.

### Slice 4

Handle Circle notification types:

- acknowledge `webhooks.test`
- pass `contracts.eventLog` into existing provider ingestion
- reject unsupported Circle notification types safely

Status: `complete`.

### Slice 5

Add regression coverage and docs:

- signature success/failure coverage
- Circle test notification coverage
- existing Arc/webhook regressions still pass
- document Day 28 result

Status: `complete`.

### Slice 6

Run verification, update README, commit, and push.

Status: `complete`.

## Acceptance criteria

Day 28 is complete when:

- Circle signed webhook path exists
- old `x-arc-webhook-secret` path still works
- Circle test notification returns a safe acknowledgement
- Circle eventLog notification can reach existing provider ingestion
- invalid Circle signature is rejected
- tests/typecheck/build pass
- no Circle API key or secret value is committed
- README points to Day 28 docs

## Decision rule

If a step requires Circle API credentials or a real provider callback, document
the remaining external step instead of faking it in code.
