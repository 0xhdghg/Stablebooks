# Stablebooks Day 28 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 28 is complete.

Stablebooks can now receive Circle-signed webhook notifications at the backend
level while preserving the existing hosted rehearsal secret-header path.

## Delivered

- raw body support for webhook signature verification
- Circle webhook verifier service
- Circle `webhooks.test` acknowledgement
- Circle `contracts.eventLog` ingestion through the existing provider decoder
- invalid Circle signature rejection
- compatibility with `x-arc-webhook-secret`
- regression coverage
- README update

## Verification

Commands run:

```text
corepack pnpm --filter @stablebooks/api typecheck
corepack pnpm --filter @stablebooks/api test
```

Result:

- typecheck passed
- API build passed
- Arc regression suite passed
- webhook retry/replay regression suite passed

## Practical outcome

The remaining Circle step is no longer a backend shape gap.

Next work can safely focus on deployment and external execution:

- deploy Day 28 backend changes
- configure `CIRCLE_API_KEY` in hosted secrets
- switch Circle Console webhook URL from webhook.site to Stablebooks API
- generate one real Arc Testnet USDC `Transfer`
- verify the resulting provider-delivered payment evidence

