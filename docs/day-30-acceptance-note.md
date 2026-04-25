# Stablebooks Day 30 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 30 fixed hosted matching when the same settlement wallet address exists in
multiple organizations.

The matcher now considers all active wallets with the observed chain/address
when looking for open payment attempts. This keeps exact amount matching as the
safety gate while avoiding false `unmatched` results caused by duplicate test
wallet registrations.

## Verification

Local API checks passed:

```text
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
```

Hosted Railway deployment succeeded:

```text
Deploy Day 30 duplicate wallet matching fix
```

The real Arc Testnet transaction was replayed through the hosted webhook path:

```text
0x2f0d3b390b968aa13d48302fa73bf2f6e087671fc20023f2ba5a05330910075b
```

Result:

- invoice `SB-20C8AC` became `paid`
- payment `pay_1b0fc68f32a20f58` became `finalized`
- match result is `exact`
- native Arc USDC amount is `250000000000000000` with `18` decimals
- log index is `55`

## Remaining provider note

The hosted backend can now process the real native Arc payment shape. Circle
Event Monitor still needs to deliver native Arc USDC logs from
`0x1800000000000000000000000000000000000000`; otherwise we need a small
forwarder/indexer fallback for production-grade automatic delivery.
