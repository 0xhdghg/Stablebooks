# Stablebooks Day 29 Acceptance Note

## Status

Accepted locally on `2026-04-25`.

## Acceptance statement

Day 29 adds backend support for the real Arc Testnet MetaMask payment path.

The API can now decode Circle/Event Monitor-style low-level native Arc USDC
logs from:

```text
0x1800000000000000000000000000000000000000
```

using:

- `topics[1]` as sender
- `topics[2]` as recipient
- `data` as the raw 18-decimal USDC amount

## Verification

The API regression suite passed:

```text
corepack pnpm --filter @stablebooks/api test
```

Covered paths:

- existing decoded provider payloads
- Circle-signed webhook event payloads
- native Arc USDC low-level event payloads
- exact invoice matching with 18-decimal native amounts
- finality transition to paid invoice state
- webhook retry/replay regressions

## Operational note

The Day 28 `0x3600000000000000000000000000000000000000` profile remains a
contract-interface path, but it is not the normal MetaMask wallet-send flow.

Hosted staging should use:

```text
ARC_EVENT_CONTRACT_ADDRESS=0x1800000000000000000000000000000000000000
ARC_EVENT_SIGNATURE=ArcNativeUSDCTransfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=18
```
