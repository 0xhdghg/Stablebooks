# Stablebooks Day 32 Execution Plan

## Goal

Fix the hosted Arc payment race where a real Arc USDC observation can arrive
before the public payment session exists.

## Context

Day 31 added the `rpc_polling` Arc native log forwarder. Hosted testing proved
that the forwarder can detect the real Arc transaction and persist the raw
event plus observation automatically.

The remaining failure case is timing:

- customer opens a public invoice
- customer sends Arc Testnet USDC very quickly
- the Arc poller ingests the transfer before `payment_session_created`
- the first match pass has no payment candidate yet
- the later payment session creation does not re-check the stored observation

The operator can currently recover this manually with the existing observation
match and confirm endpoints. The product needs to do that automatically.

## Scope

- Keep the existing Arc forwarder, canonical event shape, and matching rules.
- Keep exact amount matching as the safety gate.
- After hosted payment session creation, re-check already stored Arc
  observations that can belong to the invoice settlement wallet and amount.
- If the re-check produces an exact match and the observation already has
  source confirmation data, finalize through the existing terminal payment
  path.
- Preserve JSON fallback behavior unless a minimal equivalent is already
  available.
- Do not add schema, dependencies, frontend routes, or new provider concepts.

## Slice 1 - Locate The Existing Flow

- Identify the public payment-session entrypoint.
- Identify the Postgres session creation method.
- Identify the existing stored-observation matching method.
- Identify the existing finality method used after a match.

## Slice 2 - Add Minimal Rematch Hook

- Add a narrowly scoped Postgres rematch helper called from payment session
  creation.
- Search only detected/unmatched observations for the invoice settlement wallet,
  configured token, expected chain, and exact normalized amount.
- Reuse `matchStoredObservation` rather than duplicating match rules.

## Slice 3 - Auto-Finalize Already Confirmed Observation

- If the matched observation has `sourceConfirmedAt`, finalize the payment
  using the existing Arc-ingestion confirmation path.
- Preserve idempotency if the payment is already finalized.

## Slice 4 - Regression Coverage

- Add a focused test for:
  - observation first
  - payment session second
  - exact rematch
  - automatic finalized invoice
- Keep existing Day 30 duplicate-wallet behavior intact.

## Slice 5 - Hosted Verification

- Deploy API to Railway.
- Create a fresh invoice.
- Pay quickly from MetaMask.
- Verify the invoice reaches `paid` without manual match or confirm.

## Acceptance

- A stored Arc observation that arrived before payment-session creation can be
  matched after the payment session is created.
- Exact amount matching remains required.
- Ambiguous matches remain ambiguous.
- Confirmed observations can finalize the payment without manual intervention.
- Hosted public payment flow reaches receipt/success without a manual
  `/mock/observations/:id/match` or `/confirm` call.
