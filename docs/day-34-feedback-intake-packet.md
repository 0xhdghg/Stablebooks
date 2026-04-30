# Stablebooks Day 34 Feedback Intake Packet

## Purpose

This packet defines how Stablebooks should collect and triage feedback during
the controlled Arc Testnet launch.

The goal is to make every report actionable without asking testers to repeat
the whole flow from memory.

## Public Feedback Request

Use this wording in public replies or DMs:

```text
Thanks for testing Stablebooks.

Please send:

- what happened
- invoice ref
- public payment URL
- txHash, if a transaction was sent
- screenshot
- browser
- wallet
- Arc account address
- approximate time
```

## Success Report Template

```text
Result: worked
Invoice ref:
Public payment URL:
txHash:
Browser:
Wallet:
Arc account address:
Approximate time:
Notes:
```

## Bug Report Template

```text
Result: failed / unclear
What happened:
Expected result:
Invoice ref:
Public payment URL:
txHash:
Browser:
Wallet:
Arc account address:
Approximate time:
Screenshot:
```

## Triage Categories

Use one category per primary issue.

```text
auth_login
customer_create
invoice_create
public_payment_page
metamask_arc_testnet
arc_transaction_pending
arc_transaction_confirmed_not_detected
payment_stuck_processing
payment_matched_wrong_amount
payment_success_route
operator_invoice_detail
webhook_delivery_visibility
hosted_runtime
documentation_confusion
```

## Priority Levels

### P0 - Pause Launch

Use P0 if:

```text
hosted app unavailable
hosted API unavailable
confirmed exact Arc payment does not ingest for multiple testers
payment finalizes the wrong invoice
private data leaks in public pages
```

Action:

```text
pause public sharing
check Railway API logs
check /api/v1/health/runtime
check latest RawChainEvent/payment state
post an update only after the issue is understood
```

### P1 - Fix Before Wider Sharing

Use P1 if:

```text
some testers cannot create invoices
confirmed payment is detected but public page does not route to success
operator detail hides txHash/block/match evidence
MetaMask instructions are consistently confusing
```

Action:

```text
capture repro
open a focused fix slice
avoid broad refactors
verify hosted after patch
```

### P2 - Track During Testnet

Use P2 if:

```text
copy is confusing
layout is rough but usable
manual refresh is needed after success
webhook disabled warning is confusing
non-critical browser-specific visual issue
```

Action:

```text
record issue
batch into UI/copy polish
do not block controlled launch
```

## First Checks For Payment Reports

For any payment-related report, collect:

```text
invoice ref
public token
payment public token, if visible
txHash
amount sent
sender address
receiver address
Arc explorer status
```

Then check:

```text
public status endpoint
operator payment list
Railway API logs
Arc transaction receipt
RawChainEvent existence
PaymentObservation existence
PaymentMatch existence
WebhookDelivery status
```

Expected successful state:

```text
invoiceStatus -> paid
paymentStatus -> finalized
matchResult -> exact
redirectHint -> success
txHash -> present
blockNumber -> present
sourceConfirmedAt -> present
```

## Known Expected Reports

These are expected during controlled testnet and are not automatically blockers:

```text
MetaMask transaction stays pending
tester sends the wrong amount
tester sends to the wrong network
tester uses a stale public payment URL after invoice is already paid
merchant webhook shows disabled because no destination is configured
RPC polling takes a short delay after onchain confirmation
```

## Operator Response Snippets

### Pending MetaMask Transaction

```text
This looks like a MetaMask/Arc pending transaction issue. If it has not appeared
on the Arc explorer after a few minutes, cancel it in MetaMask and retry with a
fresh transaction for the exact invoice amount.
```

### Confirmed But Not Finalized

```text
Thanks, this is the important case. Please send the invoice ref, public payment
URL, txHash, screenshot, wallet, browser, and approximate time. We will check
the Arc receipt, ingestion event, match record, and payment status.
```

### Wrong Amount

```text
Stablebooks currently expects exact payment amounts during testnet. Please
create a fresh invoice and send the exact amount shown on the payment page.
```

### Testnet Reminder

```text
Please use Arc Testnet only. Do not send mainnet funds.
```

## Storage Location

For now, store incoming feedback manually in the project issue tracker or a
simple private spreadsheet. Keep each report linked to:

```text
invoice ref
txHash
triage category
priority
status
```
