# Stablebooks Day 34 Execution Plan

## Goal

Prepare Stablebooks for a controlled public Arc Testnet announcement.

The day is focused on launch readiness artifacts and hosted verification, not
new product architecture.

## Scope

- Keep Railway hosted runtime as the canonical baseline.
- Keep the current Arc Testnet `rpc_polling` source.
- Do not introduce new providers, contracts, dependencies, or data models.
- Do not redesign the frontend.
- Only make minimal documentation or verification changes needed for launch.

## Slice 1 - Pre-Launch Hosted Smoke

- Verify hosted API liveness and readiness.
- Verify hosted Web availability.
- Verify the latest known real Arc E2E invoice still shows a finalized success
  state.
- Capture the results in a Day 34 hosted verification note.

## Slice 2 - Public Announcement Copy

- Draft concise X.com announcement copy.
- State that this is controlled Arc Testnet testing.
- Avoid production/mainnet claims.
- Include the hosted app URL and expected feedback channel.

## Slice 3 - Tester Instructions

- Produce a short tester guide.
- Include login/account flow, invoice creation, payment flow, expected success
  state, and what evidence to send back.

## Slice 4 - Feedback Intake Packet

- Define what testers should report for bugs:
  invoice reference, public token, txHash, screenshot, wallet, browser, and
  approximate timestamp.
- Include triage labels or categories for payment, wallet, UI, auth, and
  hosted runtime issues.

## Slice 5 - Launch Sign-Off

- Run one final hosted smoke after documentation is complete.
- Record launch go/no-go state.
- Capture known limits and rollback/pause criteria.

## Acceptance

- Hosted API and Web are reachable before launch.
- Latest real Arc E2E state remains finalized and publicly routable.
- Public announcement copy is ready.
- Tester instructions are ready.
- Feedback intake instructions are ready.
- Final sign-off document clearly states whether the controlled testnet
  announcement can proceed.
