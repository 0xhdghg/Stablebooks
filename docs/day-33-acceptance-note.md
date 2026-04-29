# Stablebooks Day 33 Acceptance Note

## Goal

Day 33 hardened the hosted Arc Testnet public payment flow enough to prepare a
controlled public testnet announcement.

## Accepted Scope

- Real Arc E2E evidence was documented.
- The RPC poller now resumes from the latest persisted Arc event checkpoint
  instead of relying only on the configured `ARC_START_BLOCK`.
- Public payment routes now guard against stale issue/processing/success states.
- A fresh real Arc Testnet invoice completed through automatic ingestion,
  exact matching, finalization, and stable success routing.
- A public testnet launch checklist is available.

## Final Hosted E2E Evidence

```text
invoice -> SB-9992D5
invoiceId -> inv_515997428d6b1fc2
publicToken -> pub_269819910985f3566aa65b4f
paymentId -> pay_5630eedf657868b3
amount -> 0.31 USDC
txHash -> 0x2a73231db61a31fa59e157253bf5584e899ba1bb4a1ad8e4e9e2c8b27ba63d49
blockNumber -> 39691767
logIndex -> 26
invoiceStatus -> paid
paymentStatus -> finalized
matchResult -> exact
redirectHint -> success
manual backend recovery -> not required
```

## Non-Blocking Limits

- The hosted source remains `rpc_polling`.
- Circle-native event delivery is not the active source for this launch.
- Merchant outbound webhook delivery is disabled unless
  `STABLEBOOKS_WEBHOOK_URL` is configured.
- Arc Testnet MetaMask transactions can remain pending; if that happens, the
  tester should cancel and retry.

## Result

Day 33 is accepted for controlled public Arc Testnet testing. The next safe
step is to use the launch checklist for an X.com announcement and monitor the
first external test payments closely.
