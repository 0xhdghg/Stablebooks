# Stablebooks Day 33 Real Arc E2E Evidence

## Summary

On `2026-04-29`, a real Arc Testnet native USDC payment finalized a hosted
Stablebooks invoice through the `rpc_polling` source.

This run confirmed the core hosted payment loop:

1. Operator created a hosted invoice.
2. Customer paid native Arc Testnet USDC to the settlement wallet.
3. RPC polling ingested the native USDC transfer log.
4. The observation matched the invoice by settlement wallet, token, chain, and
   exact amount.
5. The payment moved to `processing` and then `finalized`.
6. The invoice moved to `paid`.
7. Public status returned `redirectHint -> success`.

## Hosted Runtime

- API: `https://stablebooks-api-production.up.railway.app`
- Web: `https://stablebooks-web-production.up.railway.app`
- Runtime: Railway `production`
- Source kind: `rpc_polling`
- Chain id: `5042002`
- Token: `USDC`
- Token decimals: `18`
- Native Arc USDC contract: `0x1800000000000000000000000000000000000000`
- Settlement wallet: `0x1111111111111111111111111111111111111111`

## Invoice

- Reference: `SB-CFBAFF`
- Invoice id: `inv_17a6727e7fa046f3`
- Public token: `pub_fd89510e735219d4ea0f1b21`
- Amount: `$0.25`
- Amount minor: `25`
- Initial status: `open`
- Final status: `paid`

## Payment

- Payment id: `pay_3d2bbd31d0affe45`
- Status: `finalized`
- Match result: `exact`
- Match reason: observation matched exactly by wallet routing, accepted token,
  and amount.
- Settlement reference: `arc-rpc-18a7097a-17`
- Confirmation source: `arc_ingestion`

## Arc Transaction

- Tx hash:
  `0x18a7097ad767fa7b54a0b75448e1a1a3b547ca6bb18edb42259ed8f892017f20`
- Block number: `39643642`
- Log index: `17`
- From: `0x69a5a79242eb4ac6a4de45779090d54ecae721d0`
- To: `0x1111111111111111111111111111111111111111`
- Amount atomic: `250000000000000000`
- Amount normalized: `0.25 USDC`
- Source confirmed at: `2026-04-29T13:15:24.000Z`
- Observed at: `2026-04-29T13:31:15.753Z`
- Finalized at: `2026-04-29T13:31:15.964Z`

## Result

Public invoice status after ingestion:

```text
invoiceStatus -> paid
paymentStatus -> finalized
amountPaidMinor -> 25
finalSettlement -> true
redirectHint -> success
```

## Operational Gap Found

The hosted RPC poller initially did not ingest the real transaction quickly
because `ARC_START_BLOCK` was still set to `39098473`, while the real payment
was in block `39643642`.

The poller scans fixed block ranges and therefore needed a manual hosted env
update to start near the current chain:

```text
ARC_START_BLOCK=39643000
```

After redeploying the API with the updated start block, the poller ingested the
real tx and finalized the invoice automatically.

## Next Target

Day 33 Slice 2 should harden the polling cursor/checkpoint behavior so normal
testnet operation does not depend on manually bumping `ARC_START_BLOCK`.
