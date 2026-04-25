# Stablebooks Day 4 Arc Event Contract

## Document status

- Date: `2026-04-20`
- Scope: `Slice 1 / inbound contract`
- Status: `decided`

## Goal

Freeze one canonical inbound Arc event shape for the first real ingestion
adapter, plus the validation rules that decide whether an event is accepted,
rejected, or ignored.

## Canonical inbound event

The Arc adapter should normalize provider-specific payloads into this internal
contract before handing anything to the payment pipeline:

```json
{
  "txHash": "0x...",
  "blockNumber": 123456,
  "confirmedAt": "2026-04-20T18:00:00.000Z",
  "from": "0x...",
  "to": "0x...",
  "token": "USDC",
  "amount": "1250000000",
  "decimals": 6,
  "chainId": 777,
  "logIndex": 0,
  "blockTimestamp": "2026-04-20T17:59:42.000Z",
  "rawPayload": {}
}
```

## Required fields

These fields are required for Day 4 acceptance:

- `txHash`
- `blockNumber`
- `confirmedAt`
- `from`
- `to`
- `token`
- `amount`
- `decimals`
- `chainId`

## Optional but strongly preferred fields

- `logIndex`
- `blockTimestamp`
- `rawPayload`

## Field semantics

- `txHash`: the chain transaction identifier
- `blockNumber`: the block height where Stablebooks observed the transfer
- `confirmedAt`: the time Stablebooks considers the transfer confirmed enough
  for downstream processing
- `from`: sender address
- `to`: recipient address, expected to be one of the organization's configured
  settlement wallets
- `token`: normalized asset symbol or configured token identifier
- `amount`: atomic amount as a base-10 integer string
- `decimals`: token precision used to interpret `amount`
- `chainId`: Arc network identifier used for routing and uniqueness
- `logIndex`: event position within the transaction when available
- `blockTimestamp`: source block timestamp for auditability
- `rawPayload`: provider-native payload retained for debugging

## Validation rules

The adapter must validate these rules before an event enters the raw evidence
layer.

### Hard reject rules

Reject the event immediately if any of these are true:

- `txHash` is missing or blank
- `blockNumber` is not a positive integer
- `confirmedAt` is missing or not a valid ISO timestamp
- `from` is missing or blank
- `to` is missing or blank
- `token` is missing or blank
- `amount` is not a base-10 integer string
- `decimals` is not a non-negative integer
- `chainId` is not a positive integer

### Routing reject rules

Reject the event for payment processing, but keep enough context for debugging,
if any of these are true:

- `to` does not match any configured organization settlement wallet
- `token` is unsupported by the target wallet or invoice rail
- the payload cannot be normalized into the canonical contract

### Ignore or dedupe rules

Do not create a new payment observation if the event is already known.

Use this idempotency order:

1. `(chainId, txHash, logIndex)` when `logIndex` is available
2. `(chainId, txHash, to, amount)` as fallback

## Normalization rules

Before the event enters domain matching:

- trim all string fields
- uppercase `token`
- preserve addresses as received for display, but compare them case-insensitively
- preserve `amount` as an integer string without decimal formatting
- set `logIndex = 0` only when the source has no better event position value
- store `rawPayload` exactly as the provider returned it when available

## Acceptance meaning

An accepted Arc event means only this:

- the payload is structurally valid
- the transfer is confirmed enough for Day 4 policy
- the event can be persisted as raw evidence
- the event can be normalized into an observation

It does not yet mean:

- the transfer matches an invoice
- the amount is correct
- the token is acceptable for settlement
- the payment should automatically finalize

Those checks belong to matching and confirmation logic after ingestion.

## Example outcomes

### Accepted

- transfer to a known settlement wallet
- `USDC`
- `amount = "1250000000"`
- valid `txHash`, `blockNumber`, `confirmedAt`, `chainId`

Result:

- persist raw event
- create normalized observation
- continue to matching

### Rejected

- missing `confirmedAt`
- malformed `amount`
- blank `to`

Result:

- reject before domain processing

### Ignored as duplicate

- same `chainId`, `txHash`, and `logIndex` as an existing raw event

Result:

- do not create a second raw event or observation

## Implementation note

The Arc adapter should be the only place that knows provider-specific payload
shape. Everything after the adapter should continue to work against this
canonical contract.
