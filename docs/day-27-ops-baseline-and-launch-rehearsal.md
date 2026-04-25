# Stablebooks Day 27 Ops Baseline And Launch Rehearsal

## Document status

- Date: `2026-04-25`
- Scope: `Day 27 Slice 5`
- Status: `accepted`

## Purpose

This document defines the minimum operations baseline and the single launch
rehearsal worksheet for moving from MVP-ready staging toward a controlled
production launch.

It does not replace production monitoring tooling. It defines the minimum
signals and ownership required before executing real provider and merchant
dependencies.

## Required owners

Assign these before launch rehearsal:

```text
Deployment owner: <name>
Provider integration owner: <name>
Merchant webhook owner: <name>
Database owner: <name>
Rollback decision owner: <name>
Incident contact: <name>
```

No launch rehearsal should proceed if rollback ownership is unknown.

## Minimum health checks

API checks:

```text
GET <api-origin>/api/v1/health/live
GET <api-origin>/api/v1/health/runtime
```

Expected:

- API status `ok`
- Postgres reachable
- Postgres-backed runtime ready
- hosted runtime policy `policyOk=true`
- hosted JSON fallback not allowed
- Arc readiness `true`
- Arc source kind `webhook`

Web checks:

```text
GET <web-origin>/signin
GET <web-origin>/dashboard
GET <web-origin>/webhooks?queue=all
```

Expected:

- routes return `200`
- dashboard can show runtime readiness
- webhook queue can show delivery state

## Minimum alert triggers

Before production launch, make sure someone is watching or can be alerted on:

- API unavailable
- Postgres unreachable
- hosted runtime policy not ok
- Arc readiness not ready
- provider callback rejected
- payment stuck before finality
- merchant webhook delivery failing
- webhook deliveries entering dead-letter unexpectedly

This can start as manual checks during the first controlled launch rehearsal,
but the owner must be explicit.

## Rollback checkpoints

Use these checkpoints during rehearsal:

### Checkpoint 1: Before provider event

If readiness is not green, stop before sending provider traffic.

### Checkpoint 2: After provider event

If provider event is rejected, pause provider ingestion before repeated retries
create noise.

Rollback flag:

```env
ARC_SOURCE_ENABLED=false
```

### Checkpoint 3: After payment finality

If payment finality is wrong, stop merchant delivery and inspect payment
evidence before replaying anything.

### Checkpoint 4: After merchant webhook delivery

If merchant delivery fails, pause merchant webhook egress before replaying.

Rollback flag:

```env
STABLEBOOKS_WEBHOOK_URL=
```

Do not delete chain evidence, payments, payment events, or webhook deliveries.

## Launch rehearsal worksheet

### Step 1: Record runtime target

```text
API origin: <api-origin>
Web origin: <web-origin>
Commit SHA: <commit-sha>
Railway environment: <environment-name>
```

### Step 2: Verify readiness

Record:

```text
/health/live result: <pass/fail>
/health/runtime result: <pass/fail>
hosted policy: <pass/fail>
Arc readiness: <pass/fail>
outbound webhook posture: <configured/disabled>
```

### Step 3: Create test invoice

Record:

```text
Customer id: <customer-id>
Invoice id: <invoice-id>
Public token: <public-token>
Settlement wallet: <wallet-address>
Expected amount: <amount>
Expected token: <token>
Expected chain id: <chain-id>
```

### Step 4: Open public payment page

Record:

```text
Payment page URL: <web-origin>/pay/<public-token>
Page opened: <yes/no>
```

### Step 5: Execute provider event

Record:

```text
Provider delivery log id: <provider-log-id>
txHash: <tx-hash>
blockNumber: <block-number>
provider response status: <status>
```

### Step 6: Verify Stablebooks payment state

Record:

```text
Payment id: <payment-id>
Payment status: <status>
Invoice status: <status>
Match result: <exact/partial/overpaid/unmatched>
Provider diagnostics visible: <yes/no>
```

### Step 7: Verify merchant webhook state

Record:

```text
Delivery id: <delivery-id>
Event type: <event-type>
Delivery status: <status>
Attempt count: <count>
Receiver response status: <status>
Receiver log id: <receiver-log-id>
```

### Step 8: Final operator UI check

Record:

```text
Dashboard readiness visible: <yes/no>
Invoice detail evidence visible: <yes/no>
Payment txHash visible: <yes/no>
Webhook queue state visible: <yes/no>
```

## Pass criteria

The launch rehearsal passes when:

- readiness is green before provider event
- real provider event is accepted
- invoice reaches expected paid/finalized state
- tx hash is visible in the operator UI
- merchant webhook delivery succeeds or is explicitly documented as disabled
  for the rehearsal
- rollback owner remains available throughout the run
- no secrets are recorded in evidence

## No-go criteria

Stop the rehearsal if:

- readiness is not green
- provider callback URL is wrong
- provider secret cannot be authenticated
- payment cannot be matched
- payment reaches an unexpected terminal state
- merchant delivery fails without an available owner
- rollback owner is unavailable
- any production secret is exposed
