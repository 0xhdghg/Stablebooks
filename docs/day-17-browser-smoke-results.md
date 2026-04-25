# Stablebooks Day 17 Browser Smoke Results

## Document status

- Date: `2026-04-23`
- Scope: `Day 17 Slice 7`
- Status: `completed`

## Purpose

This note captures the first automated Web smoke for the production-runtime
rehearsal UI.

The smoke uses a lightweight HTTP/SSR approach. It fetches rendered Next.js
routes, sends the operator Bearer token only to operator routes, and validates
that expected UI evidence is present while public hosted pages do not expose
operator-only diagnostics.

## Approach

Chosen approach:

- lightweight HTTP/SSR smoke
- no Playwright dependency
- no browser screenshots
- Node `fetch` against a running Next server
- structured JSON pass/fail output

Command:

```text
corepack pnpm --filter @stablebooks/web smoke:production-ui
```

Script:

```text
apps/web/scripts/smoke-production-ui.js
```

## Environment Shape

Required env:

```env
SMOKE_WEB_BASE_URL=http://127.0.0.1:3000
SMOKE_OPERATOR_TOKEN=<operator-session-token>
SMOKE_INVOICE_ID=inv_c858e770c99e6168
SMOKE_PAYMENT_ID=pay_9ef0719acf0facca
SMOKE_PUBLIC_TOKEN=pub_75edadec50cf2150c7f5f6a3
```

Optional expected values used in the local run:

```env
SMOKE_EXPECTED_TX_HASH=0x3fce23e8f8ad50a20b4361c46a94e0f88138b68dd5a1c4f6ecdf6a5e60beb2d5
SMOKE_EXPECTED_WEBHOOK_STATUS=disabled
SMOKE_EXPECTED_INVOICE_STATUS=paid
SMOKE_EXPECTED_PAYMENT_STATUS=finalized
```

Secret safety:

- raw `SMOKE_OPERATOR_TOKEN` is not printed
- dry-run reports only `hasOperatorToken`
- operator token is sent only to operator routes

## Runtime

The smoke ran against the current local Day 16 rehearsal stack:

- Web: `http://127.0.0.1:3000`
- Web process id: `11332`
- API: `http://127.0.0.1:4000/api/v1`
- API process id: `9072`

## Smoke Result

Result:

```text
ok=true
```

Output log:

```text
day17-production-ui-smoke.out.log
```

## Route Checks

All route checks returned `200`.

| Check | Route | Auth | Include assertions | Exclude assertions |
| --- | --- | --- | ---: | ---: |
| `signin` | `/signin` | no | 2 | 0 |
| `dashboard` | `/dashboard` | yes | 2 | 0 |
| `invoice-detail` | `/invoices/inv_c858e770c99e6168` | yes | 6 | 0 |
| `payment-detail` | `/payments/pay_9ef0719acf0facca` | yes | 6 | 0 |
| `webhook-queue` | `/webhooks?queue=all` | yes | 4 | 0 |
| `hosted-paid-page` | `/pay/pub_75edadec50cf2150c7f5f6a3` | no | 2 | 5 |

## Assertion Summary

Invoice detail verified:

- invoice id
- `paid`
- `finalized`
- provider source card
- expected tx hash
- webhook section

Payment detail verified:

- payment id
- `finalized`
- provider source card
- chain source confirmation label
- expected tx hash
- webhook section

Webhook queue verified:

- `payment.finalized`
- `disabled`
- `No destination configured`
- smoke payment short id

Hosted paid page verified:

- `Stablebooks Pay`
- `Payment complete`
- no repeat payment action
- no provider source diagnostics
- no webhook delivery diagnostics
- no internal event type
- no expected tx hash

## Limitations

This smoke does not verify:

- real browser rendering/layout
- client-side navigation after clicks
- form submission behavior
- viewport/responsive behavior
- screenshots
- cross-browser behavior

These are intentionally deferred until Playwright or another browser automation
tool is added.

## Acceptance

Day 17 browser smoke result is accepted for a first production-runtime UI gate:

- command exists
- env-driven config works
- secret output is safe
- all target routes return `200`
- operator pages expose expected production-runtime evidence
- public hosted page hides operator-only diagnostics
- result is captured in a machine-readable log

## Next Use

Use this smoke before hosted staging deployment:

1. Run or seed a production-runtime rehearsal flow.
2. Start API and Web for the target environment.
3. Export smoke env with the created invoice/payment/public token IDs.
4. Run `corepack pnpm --filter @stablebooks/web smoke:production-ui`.
5. Treat any non-zero exit as a staging gate failure.
