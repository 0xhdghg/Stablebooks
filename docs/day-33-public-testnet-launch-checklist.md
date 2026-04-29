# Stablebooks Day 33 Public Testnet Launch Checklist

## Launch Target

Stablebooks can be announced as an Arc Testnet receivables MVP after the Day 33
hosted hardening pass.

Live app:

```text
https://stablebooks-web-production.up.railway.app
```

Operator login for controlled demo/testing:

```text
email -> arc-operator@stablebooks.dev
password -> stablebooks123
```

## Tester Flow

1. Open the hosted Stablebooks app.
2. Sign in or create an account for the test workspace.
3. Create a customer if needed.
4. Create an invoice with a small Arc Testnet USDC amount.
5. Open the hosted payment link for the invoice.
6. Pay the exact amount from MetaMask on Arc Testnet.
7. Wait for the hosted payment page to move to success.
8. Return to the operator invoice detail and confirm:
   - invoice status is `paid`
   - payment status is `finalized`
   - `txHash` is visible
   - block number is visible
   - source confirmation timestamp is visible
   - match result is `exact`

## Known Testnet Limits

- This is Arc Testnet only.
- Native Arc USDC is monitored from
  `0x1800000000000000000000000000000000000000`.
- Settlement wallet is currently
  `0x1111111111111111111111111111111111111111`.
- The current source is `rpc_polling`, not Circle native event delivery.
- Payments must use the exact invoice amount.
- Merchant outbound webhooks are disabled unless `STABLEBOOKS_WEBHOOK_URL` is
  configured.
- If MetaMask leaves a transaction pending, cancel it and retry with a fresh
  payment transaction before treating the product flow as failed.

## Monitoring Before Posting

Check these before the X.com announcement:

```text
GET https://stablebooks-api-production.up.railway.app/api/v1/health/live
GET https://stablebooks-api-production.up.railway.app/api/v1/health/ready
```

Confirm Railway shows:

```text
stablebooks-api -> Online
stablebooks-web -> Online
Postgres -> Online
```

Confirm the latest real E2E still shows:

```text
invoice -> SB-9992D5
paymentStatus -> finalized
matchResult -> exact
txHash -> 0x2a73231db61a31fa59e157253bf5584e899ba1bb4a1ad8e4e9e2c8b27ba63d49
```

## Rollback / Pause Criteria

Pause the public announcement if any of these happen:

- hosted API health is not `ok`
- hosted Web is unavailable
- new Arc payments remain unmatched after the transaction is confirmed
- public payment pages show raw 404s or stale error states
- operator invoice detail does not show finalized payment evidence

If paused, keep the app private, inspect Railway API logs, and verify the Arc
poller checkpoint before inviting external testers.

## Announcement Copy Guardrails

The public wording should say:

```text
Stablebooks is live for controlled Arc Testnet testing.
```

Avoid claiming:

```text
mainnet ready
production payments
Circle-native delivery
merchant webhooks enabled by default
```

## Launch Decision

Day 33 launch checklist is ready after the clean real Arc E2E rehearsal:

```text
invoice -> SB-9992D5
invoiceStatus -> paid
paymentStatus -> finalized
redirectHint -> success
manual backend recovery -> not required
```
