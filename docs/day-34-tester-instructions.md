# Stablebooks Day 34 Tester Instructions

## Purpose

This guide is for controlled Arc Testnet testers.

Stablebooks lets you create a stablecoin invoice, pay it with Arc Testnet USDC,
and confirm that the operator workspace records the onchain settlement evidence.

## App URL

```text
https://stablebooks-web-production.up.railway.app
```

## Important Limits

- Use Arc Testnet only.
- Do not send mainnet funds.
- Use small test amounts.
- Pay the exact invoice amount.
- Use MetaMask on Arc Testnet.
- If a MetaMask transaction stays pending for several minutes, cancel it and
  retry with a fresh transaction.

## Test Flow

### 1. Open Stablebooks

Go to:

```text
https://stablebooks-web-production.up.railway.app
```

Create an account or sign in with the test operator account if one was shared
with you directly.

### 2. Open The Workspace

After signing in, you should land in the Stablebooks workspace.

Expected state:

```text
left nav -> Dashboard / Customers / Invoices / Webhooks
workspace badge -> Arc settlement onboarding ready
```

### 3. Create Or Reuse A Customer

Open `Customers`.

Create a customer if needed. Use test-only details.

Example:

```text
name -> Arc Test Customer
email -> your-test-email+stablebooks@example.com
billing currency -> USD
```

### 4. Create An Invoice

Open `Invoices`, then choose `Create invoice`.

Use a small amount.

Example:

```text
customer -> your test customer
amount in minor units -> 25
currency -> USD
due date -> today or tomorrow
memo -> Arc Testnet payment test
invoice status -> Publish as open invoice
```

`amount in minor units` means cents for USD:

```text
25 -> $0.25
31 -> $0.31
100 -> $1.00
```

After creating the invoice, open the invoice detail page.

### 5. Open The Public Payment Link

On the invoice detail page, find the public payment link or public token.

Open the hosted payment page in a browser tab.

Expected URL shape:

```text
https://stablebooks-web-production.up.railway.app/pay/<public-token>/issue
```

or:

```text
https://stablebooks-web-production.up.railway.app/pay/<public-token>/processing
```

### 6. Pay With MetaMask

Use MetaMask connected to Arc Testnet.

Send the exact invoice amount in Arc Testnet USDC to the settlement address
shown by the payment page.

Expected settlement wallet:

```text
0x1111111111111111111111111111111111111111
```

After sending, keep the transaction hash.

### 7. Wait For Success

After the transaction confirms and Stablebooks ingests it, the payment page
should move to success.

Expected success state:

```text
payment page -> success / receipt state
invoice status -> paid
payment status -> finalized
match result -> exact
```

In the operator invoice detail, verify that settlement evidence is visible:

```text
txHash
block number
source confirmation timestamp
match result
```

## What To Send If It Works

Send a short success note:

```text
Worked
invoice ref:
txHash:
browser:
wallet:
approximate time:
```

## What To Send If It Breaks

Send:

```text
What happened:
Invoice ref:
Public payment URL:
txHash:
Screenshot:
Browser:
Wallet:
Arc account address:
Approximate time:
```

Useful issue categories:

```text
login/account issue
invoice creation issue
MetaMask/Arc Testnet issue
payment page issue
payment stuck processing
payment not matched
success page issue
operator UI issue
```

## Known Non-Blocking Behavior

- Merchant outbound webhooks may show as disabled because no merchant webhook
  destination is configured for the public testnet runtime.
- The current Arc source is RPC polling, so a confirmed payment may take a short
  time to appear.
- If MetaMask keeps a transaction pending and it is not visible on the explorer,
  cancel it and retry.
