# Stablebooks Day 29 Execution Plan

## Goal

Support the real Arc Testnet payment path observed through MetaMask.

Arc Testnet USDC is native gas/payment value. A normal MetaMask USDC send emits
a native Arc transfer log from:

```text
0x1800000000000000000000000000000000000000
```

The previous Day 28 source profile targeted the optional ERC-20 interface:

```text
0x3600000000000000000000000000000000000000
```

That profile is valid for contract-interface transfers, but it does not match
the wallet UX users naturally follow.

## Scope

- Add API decoding for native Arc USDC transfer logs delivered by Circle/Event
  Monitor.
- Preserve the existing Circle signed webhook path.
- Preserve the existing decoded ERC-20 provider payload path.
- Update docs/env guidance for native Arc USDC monitoring.
- Do not change payment status semantics, schema, UI, auth, or invoice model.

## Native Arc USDC event shape

Observed on Arc Testnet:

- contract/log address: `0x1800000000000000000000000000000000000000`
- indexed sender: `topics[1]`
- indexed recipient: `topics[2]`
- raw amount: `data`
- native decimals: `18`
- token symbol: `USDC`
- chain id: `5042002`

## Acceptance

- Low-level native Arc USDC event payload can normalize into canonical payment
  evidence.
- Exact invoice matching works with native 18-decimal amount precision.
- Existing decoded provider regressions still pass.
- Hosted env can be switched to the native source profile without code changes.

