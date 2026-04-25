# Stablebooks Day 1 Payment Flow Note

## Document status

- Date: `2026-04-19`
- Product: `Stablebooks`
- Scope: `Day 1 canonical payment flow and data contract`
- Companion docs:
  - [arc_treasury_os_milestone_4_foundation.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_foundation.md)
  - [arc_treasury_os_backend_api_plan.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_backend_api_plan.md)
  - [arc_treasury_os_milestone_4_execution_backlog.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_execution_backlog.md)

## Goal

Freeze one canonical invoice-to-settlement scenario for Milestone 4 so product,
backend, and UI all build against the same operating model.

This note is intentionally short. It is the compact Day 1 artifact that points
to the fuller Milestone 4 foundation document when more detail is needed.

## Canonical scenario

1. An operator publishes an invoice.
2. A customer opens the hosted invoice page and pays onchain.
3. A chain ingestion worker detects the incoming transfer.
4. Stablebooks normalizes the transfer into a chain payment observation.
5. Stablebooks matches the observation to the correct invoice and payment
   attempt.
6. The payment moves to `processing`.
7. The payment later moves to `finalized` or `failed` based on confirmation and
   validation rules.
8. Stablebooks emits a webhook for the terminal outcome.
9. The operator sees invoice status, payment status, chain metadata, and
   webhook delivery state in the UI.

## Canonical payment state interpretation

- `pending`: a payment attempt exists but no accepted matched observation is
  ready yet
- `processing`: a matched observation exists and passed initial validation
- `finalized`: the matched observation satisfied confirmation policy
- `failed`: the matched observation was later rejected or invalidated

## Minimum onchain fields

The first production-shaped ingestion path only needs this minimum contract:

- `txHash`
- `blockNumber`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`
- `confirmedAt`

## Why these fields are enough

- `txHash` gives transaction identity and supports deduplication.
- `blockNumber` supports ordering and confirmation tracking.
- `from` and `to` support sender traceability and wallet routing.
- `token`, `amount`, and `decimals` support payment rail validation and amount
  matching.
- `chainId` keeps the payment record network-explicit.
- `confirmedAt` records when Stablebooks accepted the transfer as confirmed
  enough to trigger downstream effects.

## Day 1 output

Day 1 is complete when these statements are true:

- the canonical invoice-to-settlement flow is frozen
- the minimum onchain observation contract is frozen
- backend and UI work can build on this contract without redefining payment
  semantics

## Reference

For the fuller rationale, matching rules, confirmation policy, and persistence
shape, see
[arc_treasury_os_milestone_4_foundation.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_foundation.md).
