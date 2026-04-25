# Stablebooks Day 27 Provider Dependency Packet

## Document status

- Date: `2026-04-25`
- Scope: `Day 27 Slice 2`
- Status: `accepted`

## Purpose

This packet lists the exact external provider inputs required to execute the
real Arc/Circle verification from Day 26.

It does not contain real secrets and must not be used as a secret store.

## Required owner

Assign one provider integration owner before execution.

The owner is responsible for:

- provider account access
- event monitor configuration
- final contract/token profile confirmation
- callback URL setup
- provider-side test event evidence

## Required provider access

Before execution, confirm access to:

- Circle/Event Monitor or equivalent provider account
- Arc network source configuration
- webhook destination configuration
- provider event delivery logs
- provider test event or live event trigger path

## Network and source profile inputs

Stablebooks needs these final values before production verification:

```text
ARC_CHAIN_ID=<final-chain-id>
ARC_EVENT_MONITOR_SOURCE=<provider-source-name>
ARC_EVENT_CONTRACT_ADDRESS=<final-monitored-contract-or-token>
ARC_EVENT_SIGNATURE=<final-event-signature>
ARC_EVENT_TOKEN_SYMBOL=<final-token-symbol>
ARC_EVENT_TOKEN_DECIMALS=<final-token-decimals>
```

Current expected staging/demo shape:

```text
ARC_CHAIN_ID=5042002
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
```

`ARC_EVENT_CONTRACT_ADDRESS` must be confirmed from the real provider/network
setup before production verification.

## Webhook callback targets

Provider event callback:

```text
POST <api-origin>/api/v1/arc/webhooks/events
```

Provider finality callback:

```text
POST <api-origin>/api/v1/arc/webhooks/finality
```

Expected header:

```text
x-arc-webhook-secret: <ARC_WEBHOOK_SECRET>
```

## Secret placement

`ARC_WEBHOOK_SECRET` must be:

- generated outside the repository
- stored only in deployment secret storage
- configured in the provider webhook header
- configured in Railway API service secrets
- never reused as `STABLEBOOKS_WEBHOOK_SECRET`
- never pasted into docs, commits, screenshots, or issue comments

## Required provider payload fields

The provider event must include or allow Stablebooks to derive:

- `txHash`
- `blockNumber`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`
- `confirmedAt`

If available, include:

- `logIndex`

`logIndex` strengthens idempotency for EVM-style event streams.

## Provider configuration checklist

Before the first real verification:

- provider account access confirmed
- Arc network/source selected
- monitored contract/token address confirmed
- transfer event selected
- callback URL points to the intended API origin
- secret header configured
- provider logs are accessible
- provider can show delivery status and response code

## Stablebooks preflight checklist

Before asking the provider to deliver the event:

- API is deployed
- Web is deployed
- Postgres-backed runtime is ready
- `/api/v1/health/runtime` is green
- `ARC_SOURCE_ENABLED=true`
- `ARC_SOURCE_KIND=webhook`
- source profile env matches provider configuration
- launch operator can sign in
- test invoice exists
- settlement wallet address is known

## Pass evidence

Provider dependency execution passes when the team can capture:

- provider delivery log showing callback attempted
- Stablebooks response code for provider callback
- invoice id
- payment id
- tx hash
- payment status `finalized`
- match result `exact`
- operator UI screenshot or note confirming tx/provider diagnostics visible

Do not record secrets in the evidence.

## Fail evidence

If the provider step fails, capture:

- failing callback endpoint
- provider response code
- safe rejection reason from Stablebooks, if available
- source profile values that are safe to disclose
- invoice id or payment id if created

Do not capture:

- `ARC_WEBHOOK_SECRET`
- provider private API keys
- private wallet keys

## No-go conditions

Do not run the real provider verification if:

- final contract/token address is unknown
- callback URL points to staging by accident
- provider cannot send the required secret header
- provider logs are not accessible
- Stablebooks runtime readiness is not green
- the test invoice settlement wallet is unknown
