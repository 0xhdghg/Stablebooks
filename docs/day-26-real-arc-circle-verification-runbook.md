# Stablebooks Day 26 Real Arc/Circle Verification Runbook

## Document status

- Date: `2026-04-25`
- Scope: `Day 26 Slice 4`
- Status: `accepted`

## Purpose

This runbook defines the first real Arc/Circle verification path after the Day
25 MVP sign-off.

The goal is to prove that a real provider-delivered on-chain event can move
through Stablebooks into operator-visible payment evidence.

## Preconditions

Before running this verification:

- production or controlled pre-production Railway API is deployed
- production or controlled pre-production Railway Web is deployed
- Postgres-backed runtime is enabled
- `/api/v1/health/runtime` is green
- final monitored contract or token address is known
- provider account access is available
- provider can send webhook callbacks to the Stablebooks API
- `ARC_WEBHOOK_SECRET` is stored in deployment secrets
- no real secret value is written into docs, commits, screenshots, or tickets

## Stablebooks API target

Provider callbacks must target:

```text
POST <api-origin>/api/v1/arc/webhooks/events
POST <api-origin>/api/v1/arc/webhooks/finality
```

Expected auth header:

```text
x-arc-webhook-secret: <ARC_WEBHOOK_SECRET>
```

## Stablebooks Arc config

Use webhook-first mode:

```env
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=0x1800000000000000000000000000000000000000
ARC_EVENT_SIGNATURE=ArcNativeUSDCTransfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=18
```

Do not enable polling for this verification.

This profile matches the real MetaMask Arc Testnet wallet-send path observed
during hosted testing. The optional ERC-20 interface at
`0x3600000000000000000000000000000000000000` is not the normal wallet-send
source and should not be used for this verification unless the test explicitly
uses that contract-interface path.

## Provider setup checklist

In the provider/Event Monitor tool:

- create or select the Arc network source
- select the Arc native USDC log address:
  `0x1800000000000000000000000000000000000000`
- monitor the native Arc USDC transfer event
- include transaction hash, block number, sender, recipient, token, amount,
  decimals, chain id, and confirmation timestamp in the payload
- set callback URL to the Stablebooks API event endpoint
- configure the shared webhook secret header expected by Stablebooks
- configure finality callback behavior if the provider supports separate
  confirmation/finality delivery

## Test invoice setup

In Stablebooks:

1. sign in as the launch operator
2. confirm settlement wallet address
3. create or select a test customer
4. create an invoice with the expected token/amount
5. open the public payment page
6. record the invoice id, public token, and expected settlement wallet

Do not manually edit database rows during the test.

## Real transaction requirement

Send a real Arc test transaction that matches the invoice:

- recipient equals the invoice settlement wallet
- token equals configured `ARC_EVENT_TOKEN_SYMBOL`
- amount equals the invoice expected amount
- chain id equals configured `ARC_CHAIN_ID`
- transaction hash is unique

## Expected event fields

Stablebooks needs these on-chain fields:

- `txHash`
- `blockNumber`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`
- `confirmedAt`

If the provider also sends `logIndex`, Stablebooks should use it as part of
idempotency for EVM-style events.

## Expected Stablebooks result

After the provider sends the event and finality signal:

- invoice status becomes `paid`
- payment status becomes `finalized`
- match result is `exact`
- payment detail shows `txHash`
- payment detail shows provider boundary diagnostics
- invoice detail shows latest payment evidence
- webhook queue contains the expected merchant delivery state

## Verification commands

Use safe readiness checks:

```powershell
Invoke-RestMethod '<api-origin>/api/v1/health/runtime' | ConvertTo-Json -Depth 8
```

If running the existing hosted rehearsal as a control, keep it separate from
the real provider test and do not treat rehearsal output as proof of provider
delivery.

## Failure handling

If provider event authentication fails:

- verify the provider is sending `x-arc-webhook-secret`
- verify the deployed `ARC_WEBHOOK_SECRET`
- do not log or paste the secret value

If provider profile validation fails:

- compare chain id
- compare monitored contract address
- compare event signature
- compare token symbol and decimals

If payment matching fails:

- verify recipient equals settlement wallet
- verify amount and decimals
- verify invoice is open and not expired
- verify the event chain id matches invoice expected chain id

If webhook delivery fails:

- do not reprocess the chain event first
- inspect webhook delivery status
- use retry/replay controls after merchant destination is corrected

## Pass criteria

Real Arc/Circle verification passes when:

- provider-delivered event is accepted
- duplicate provider delivery is idempotent
- payment is matched to the invoice
- payment reaches `finalized`
- operator UI shows the `txHash` and provider diagnostics
- merchant webhook delivery is either successful or intentionally documented as
  disabled for the run

## No-go criteria

Do not claim real Arc/Circle verification is complete if:

- only the mock/hosted rehearsal was run
- the provider secret was bypassed
- the event was manually inserted into Postgres
- source profile validation was disabled
- the operator cannot inspect resulting payment evidence in the UI
