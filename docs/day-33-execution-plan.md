# Stablebooks Day 33 Execution Plan

## Goal

Harden the hosted public Arc Testnet flow for a public testnet announcement.

The product should be safe to share with external testers only after a clean
real Arc payment can move from invoice creation to finalized receipt without
manual backend recovery.

## Context

Day 32 fixed the race where an Arc observation can arrive before the public
payment session exists. A real Arc Testnet transaction later confirmed that the
backend can ingest native Arc USDC logs and finalize a hosted invoice.

During that hosted run, we found one operational gap: the RPC poller starts
from `ARC_START_BLOCK` and scans in fixed ranges. If the configured start block
is too far behind the current chain, a fresh payment can be delayed until the
poller catches up. For public testing, this needs an explicit cursor/checkpoint
strategy instead of a manual Railway env bump.

## Scope

- Keep the current `rpc_polling` Arc source.
- Keep the current native Arc USDC contract and exact amount matching rules.
- Keep Railway hosted staging as the canonical runtime.
- Do not add a new provider, smart contract, database model, or frontend
  redesign.
- Make only the smallest changes needed to reduce launch risk.

## Slice 1 - Real Arc E2E Evidence

- Document the real Arc Testnet transaction that finalized a hosted invoice.
- Capture the exact invoice, payment, match, block, and timing evidence.
- Record the polling cursor operational gap as the next technical target.

## Slice 2 - Polling Cursor Hardening

- Inspect the current RPC poller cursor behavior.
- Add a minimal hosted-safe checkpoint strategy so the poller can resume near
  the last processed block instead of relying only on `ARC_START_BLOCK`.
- Preserve idempotent ingestion by `(chainId, txHash, logIndex)`.

## Slice 3 - Public Payment Route Guard

- Verify the hosted public payment routes after a real payment:
  - issue
  - processing
  - success
- Fix any route/state issue that can show a 404 or stale error after payment.

## Slice 4 - Clean Real E2E Rehearsal

- Create a new hosted invoice.
- Open the public payment flow normally.
- Pay exact Arc Testnet USDC from MetaMask.
- Verify automatic ingestion, exact match, finalization, and receipt.

## Slice 5 - Launch Checklist

- Produce a short public testnet launch checklist.
- Include the live web URL, known testnet limits, expected tester flow, and
  rollback/monitoring notes.

## Acceptance

- A fresh real Arc Testnet payment finalizes without manual match or confirm.
- The poller no longer depends on manually bumping `ARC_START_BLOCK` for normal
  hosted testnet operation.
- The public customer payment flow lands on a stable success state.
- Operator UI shows the finalized payment with `txHash`, block, source
  confirmation, and match result.
- Launch checklist is ready for the X.com testnet announcement.
