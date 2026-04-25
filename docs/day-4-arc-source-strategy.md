# Stablebooks Day 4 Arc Source Strategy

## Document status

- Date: `2026-04-20`
- Scope: `Slice 1 / source strategy`
- Status: `decided`

## Decision

Stablebooks MVP will not deploy its own smart contract.

The first real Arc integration will use a wallet-based ingestion model:

1. each organization configures one or more known settlement wallet addresses
2. Stablebooks reads Arc transfer activity for those addresses from a real Arc
   source
3. matching happens offchain using the existing invoice, payment, and
   observation pipeline

## Recommended source model

The default Day 4 strategy is:

- production: Arc RPC or Arc indexer polling for inbound transfers to known
  wallet addresses
- local development: the same adapter fed by replayable fixture payloads or a
  thin local poller, without using `payments/mock/*`

If Arc later provides a stable webhook or event stream, Stablebooks can plug
that in behind the same adapter boundary. This does not change the domain model.

## Why this strategy

- no contract deployment is required
- lower operational risk for a solo builder
- works with the Day 3 pipeline almost unchanged
- keeps invoice logic offchain and easier to iterate
- lets Stablebooks validate demand before introducing contract complexity

## Why not a custom contract first

Stablebooks does not need a contract for the first useful version because the
product goal is receivables tracking and settlement visibility, not escrow or
onchain invoice logic.

A contract-first approach should wait until there is a real need for:

- escrow
- programmable release rules
- one-time deposit addresses from a factory
- enforced onchain references or memo mechanics

## Operational implication

The Arc adapter only needs to answer one question for MVP:

"Did a real transfer hit one of our known settlement wallets with the expected
token and amount?"

If yes, Stablebooks can persist the raw event, normalize it, match it, confirm
it, emit webhooks, and show the result in the UI.

## Out of scope for this decision

- final choice of Arc provider
- exact polling cadence
- finality threshold
- payload validation schema
- retry model for ingestion failures

Those belong to the next Day 4 steps.
