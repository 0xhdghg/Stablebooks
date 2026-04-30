# Stablebooks Day 34 Acceptance Note

## Accepted Outcome

Day 34 is accepted.

Stablebooks is ready for a controlled public Arc Testnet announcement at:

```text
https://stablebooks-app.xyz
```

## Completed Slices

- Slice 1: pre-launch hosted smoke.
- Slice 2: public X.com announcement copy.
- Slice 3: tester instructions.
- Slice 4: feedback intake packet.
- Slice 4.5: custom domain setup and hosted cutover.
- Slice 5: final launch sign-off.

## Final Verification

Final hosted smoke passed on `2026-04-30`:

```text
API health/live -> 200 ok
API health/storage -> 200 ok
API health/runtime -> 200 ok
Web home -> 200
Web signin -> 200
Public paid receipt -> 200
Public invoice status -> 200
CORS allow-origin -> https://stablebooks-app.xyz
```

Latest known real Arc E2E payment remains finalized and publicly routable:

```text
invoice -> SB-9992D5
publicToken -> pub_269819910985f3566aa65b4f
paymentStatus -> finalized
invoiceStatus -> paid
finalSettlement -> true
redirectHint -> success
```

## Launch Decision

Decision: `GO`

The controlled testnet announcement can proceed with the known limits and pause
criteria recorded in `docs/day-34-launch-signoff.md`.
