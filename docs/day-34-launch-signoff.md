# Stablebooks Day 34 Launch Sign-Off

## Decision

Stablebooks is `GO` for a controlled public Arc Testnet announcement.

This sign-off is limited to the current hosted testnet MVP:

- Web: `https://stablebooks-app.xyz`
- API: `https://api.stablebooks-app.xyz/api/v1`
- Runtime: Railway `production`
- Chain mode: Arc Testnet
- Source mode: `rpc_polling`

## Final Hosted Smoke

Final smoke was run on `2026-04-30` after the custom domain cutover and
documentation updates.

```text
GET https://api.stablebooks-app.xyz/api/v1/health/live -> 200 ok
GET https://api.stablebooks-app.xyz/api/v1/health/storage -> 200 ok
GET https://api.stablebooks-app.xyz/api/v1/health/runtime -> 200 ok
GET https://stablebooks-app.xyz -> 200 Stablebooks
GET https://stablebooks-app.xyz/signin -> 200 Stablebooks
GET https://stablebooks-app.xyz/pay/pub_269819910985f3566aa65b4f/success -> 200 receipt
GET /public/invoices/pub_269819910985f3566aa65b4f/status -> 200
CORS allow-origin -> https://stablebooks-app.xyz
```

Latest known real Arc E2E state:

```text
invoice -> SB-9992D5
publicToken -> pub_269819910985f3566aa65b4f
paymentId -> pay_5630eedf657868b3
txHash -> 0x2a73231db61a31fa59e157253bf5584e899ba1bb4a1ad8e4e9e2c8b27ba63d49
invoiceStatus -> paid
paymentStatus -> finalized
amountPaidMinor -> 31
finalSettlement -> true
redirectHint -> success
```

## Launch Assets

The launch packet is ready:

- Public announcement copy:
  `docs/day-34-public-announcement-copy.md`
- Tester instructions:
  `docs/day-34-tester-instructions.md`
- Feedback intake packet:
  `docs/day-34-feedback-intake-packet.md`
- Custom domain setup and completion evidence:
  `docs/day-34-custom-domain-setup-plan.md`
- Hosted verification:
  `docs/day-34-hosted-verification.md`

## Known Limits

- This is Arc Testnet only.
- Testers must not use mainnet funds.
- The current hosted chain source is `rpc_polling`, not Circle-native delivery.
- The public test is for the invoice payment loop, operator visibility, and
  settlement evidence, not production merchant accounting.
- MetaMask pending or stuck transactions can delay completion outside the app.
- Only the current Arc Testnet USDC flow is in scope for this announcement.

## Pause Criteria

Pause the public announcement or stop accepting testers if any of these happen:

- `https://stablebooks-app.xyz` is not reachable.
- `https://api.stablebooks-app.xyz/api/v1/health/live` is not `200 ok`.
- Runtime health reports hosted policy, storage, or Arc source not ready.
- Public invoice status polling fails from the custom Web origin.
- New confirmed Arc Testnet payments do not finalize or remain unmatched after
  reasonable retry time.
- Multiple testers report the same auth, invoice creation, or payment issue.
- A bug exposes private data, secrets, or cross-organization records.

## Rollback Posture

If the custom domain fails, pause the announcement and fall back internally to
the Railway domains while investigating:

```text
Web fallback -> https://stablebooks-web-production.up.railway.app
API fallback -> https://stablebooks-api-production.up.railway.app/api/v1
```

If payment ingestion fails, pause payment testing and keep the operator
workspace available for inspecting already-created invoices and evidence.

## Result

Day 34 Slice 5 is accepted. Stablebooks can proceed with a controlled public
Arc Testnet announcement using `https://stablebooks-app.xyz`.
