# Arc Treasury OS Blueprint

## One-line thesis

Build a stablecoin-native accounts receivable and treasury automation platform that uses Arc as the settlement ledger for B2B payments.

Working description:

"Create invoices, collect in USDC or EURC, settle on Arc, auto-reconcile, auto-sweep, and run treasury rules without spreadsheets."

## Why this product on Arc

Arc is not best treated as a generic EVM chain. Its strongest current advantages are:

- USDC as native gas, which makes fees predictable in dollar terms.
- Deterministic finality in under one second, which makes payment confirmation and downstream automation cleaner than on probabilistic chains.
- Native alignment with Circle tooling like Gateway, CCTP, Mint, Wallets, and App Kit.
- Explicit Arc roadmap support for invoice-linked payments, refund and dispute flows, and smart treasury agents.

That makes Arc unusually well-suited for products where:

- settlement certainty matters,
- accounting and reconciliation matter,
- users care more about moving business money than about speculation,
- crosschain liquidity matters, but the business wants one treasury center of gravity.

## Product decision

### Product name

Stablebooks

Alternative names:

- ArcLedger
- TreasuryOS
- Finality Finance

Recommended starting name:

Stablebooks

Reason:

- understandable for finance buyers,
- not overfit to Arc if you later expand,
- sounds operational, not speculative.

## Product summary

Stablebooks is a B2B platform for stablecoin receivables and treasury workflows.

Customers can:

- issue invoice links in USD or EUR,
- receive payment in USDC or EURC,
- settle business treasury balances on Arc,
- attach structured references to each payment,
- auto-classify incoming funds,
- auto-sweep balances by rule,
- export accountant-friendly ledgers,
- manage refunds and payouts later.

The product is not "accept crypto payments" in the consumer checkout sense.

It is:

- accounts receivable,
- treasury routing,
- reconciliation,
- payment operations.

## What is already crowded

Do not build these first:

- generic wallet infrastructure,
- generic Arc explorer or node tooling,
- general-purpose DEX,
- enterprise FX venue,
- tokenization issuance stack,
- privacy-first financial app that depends on Arc privacy being live now.

Why:

- Arc already has strong infra participants around wallets, node providers, indexers, and liquidity.
- Circle is directly pushing Arc toward payments, FX, treasury, and capital markets.
- Privacy features are still on the roadmap, so products blocked on confidential transfers are too early.

## What is your wedge

### Positioning wedge

Not "payments infra for everyone."

Instead:

"The finance operations layer for stablecoin B2B collections and treasury."

### Category wedge

You are not selling to crypto traders.

You are selling to:

- web3-native SaaS companies,
- agencies and service firms,
- cross-border B2B operators,
- marketplaces with seller payouts,
- affiliate and partner programs,
- lean fintech teams that already touch stablecoins but still run ops manually.

### Problem wedge

The pain is not sending USDC.

The pain is:

- matching payments to invoices,
- confirming final settlement fast enough to automate ops,
- moving balances across chains without treasury chaos,
- splitting and routing funds correctly,
- getting clean books at month end.

## Why this is solo-founder friendly

This product can start as software plus workflow, not regulated financial infrastructure.

You do not need to start with:

- fiat custody,
- bank licensing,
- liquidity provisioning,
- market making,
- institutional sales cycles.

You can begin with:

- wallet-based collection,
- Arc settlement,
- automation rules,
- exports,
- dashboard and API.

That is realistic for one person.

## ICP

### Primary ICP

Web3 and stablecoin-native B2B teams with 5 to 200 people.

Signals:

- already invoicing internationally,
- already accepting stablecoins or open to doing so,
- finance ops still depend on spreadsheets and explorers,
- one founder or ops lead is doing reconciliation manually,
- monthly inbound payment volume is meaningful but not institution-scale.

### Best first vertical

Agencies and service firms with global clients.

Why this vertical first:

- easy to understand,
- invoice-driven,
- cross-border pain is obvious,
- fast founder sales,
- no need for complex marketplace logic on day one.

### Secondary ICP

- affiliate and creator payout programs,
- B2B marketplaces,
- payroll-like contractor payment teams,
- treasury teams holding stablecoin reserves.

## Core user stories

### Story 1

As a finance lead, I create a USD invoice and get a payment link.

### Story 2

As a payer, I pay in USDC or EURC and the business sees payment confirmed immediately after final settlement.

### Story 3

As an operator, I can see which invoice was paid, by whom, on which chain, for how much, and what reference data was attached.

### Story 4

As a treasury admin, I define routing rules such as:

- keep 20,000 USDC on Arc operating wallet,
- sweep anything above that threshold into reserve wallet,
- convert a share of EURC receipts to USDC later,
- route 10% of every invoice to a partner wallet.

### Story 5

As an accountant, I export a clean ledger with:

- invoice id,
- customer,
- fiat-denominated amount,
- token paid,
- chain,
- tx hash,
- payment date,
- realized difference if partial or overpaid.

## What makes it Arc-native instead of chain-agnostic fluff

Stablebooks should use Arc in a way that genuinely improves the product:

- Arc is the primary settlement treasury.
- Invoice status flips to paid only after Arc finality, not after arbitrary confirmation counts.
- Treasury balances are normalized on Arc even when collections originate elsewhere.
- Rule-based routing and offchain bookkeeping assume pending vs final states, with no reorg window logic.
- Arc's predictable USDC gas makes every internal treasury move easy to model in accounting.

If Arc disappeared, the product would still be possible elsewhere, but worse:

- noisier fee model,
- slower final settlement,
- messier event handling,
- weaker story for B2B ops.

## Product scope

### MVP

The MVP should do five things very well:

1. Create invoice links.
2. Detect and confirm incoming payment.
3. Settle treasury balances into Arc.
4. Reconcile payment to invoice automatically.
5. Export ledger and payment history cleanly.

### V1.5

Add treasury automation:

- balance thresholds,
- auto-sweeps,
- revenue splits,
- partner payouts,
- reserve wallet policies.

### V2

Add richer payment ops:

- partial refunds,
- credit notes,
- dispute and approval workflows,
- EURC and USDC treasury conversion,
- payout approvals,
- multi-entity treasury views.

## Features to exclude from MVP

Do not build these early:

- fiat onramp or offramp,
- full accounting suite,
- stablecoin lending,
- payroll compliance stack,
- privacy-dependent workflows,
- agent wallet infrastructure,
- custom chain abstractions beyond what Arc and Circle already provide.

## Functional spec

### 1. Invoice module

Fields:

- invoice_id
- customer_id
- entity_id
- currency_denomination
- amount_fiat
- due_date
- memo
- allowed_payment_tokens
- settlement_preference
- reference_code
- status

Actions:

- create invoice
- send hosted payment link
- mark paid automatically
- mark overdue
- cancel invoice
- issue credit note

### 2. Payment collection module

Capabilities:

- receive USDC or EURC
- accept Arc-native payment first
- optionally accept supported external chains and route funds to Arc treasury
- attach structured memo/reference
- display live status: pending, final, failed, partial, overpaid

### 3. Reconciliation module

Capabilities:

- map inbound transfer to invoice_id
- handle exact, partial, and excess payment
- surface unmatched transfers
- allow operator resolution
- generate ledger entries automatically

### 4. Treasury rules engine

Capabilities:

- keep minimum operating balance
- sweep excess to reserve wallet
- split receipts to multiple wallets
- create payout batches
- schedule payout windows

### 5. Reporting and exports

Exports:

- CSV
- QuickBooks-friendly CSV
- Xero-friendly CSV
- API endpoint for ledger pull

Views:

- invoice aging
- payment status board
- treasury balance by wallet
- receipts by customer
- crosschain settlement log

## Architecture

### Frontend

Recommended stack:

- Next.js
- TypeScript
- Tailwind or minimal custom CSS
- Viem for wallet interactions
- Hosted invoice pages plus internal admin dashboard

Pages:

- `/dashboard`
- `/invoices`
- `/invoices/[id]`
- `/customers`
- `/treasury`
- `/exports`
- `/pay/[invoice_token]`

### Backend

Recommended stack:

- Node.js with TypeScript
- NestJS or Fastify
- PostgreSQL
- Redis for jobs and idempotency locks
- Queue worker for event processing

Core services:

- invoice service
- payment service
- reconciliation service
- treasury rules engine
- export service
- webhook service

### Chain integration

Use:

- Arc public RPC or managed provider
- Arc App Kit where it simplifies send, bridge, or swap flows
- indexer integration for reliable event handling

Recommended event model:

- subscribe to relevant transfer and settlement events,
- write raw event records first,
- resolve to invoice and ledger asynchronously,
- only trigger business webhooks after final confirmed Arc settlement.

### Smart contracts

Keep contracts minimal at first.

MVP contract scope:

- optional payment reference receiver contract on Arc
- optional vault/splitter contract for deterministic routing

Do not over-contract the product. Most logic should live offchain first.

Suggested contract set:

- `InvoiceReceiver.sol`
  - receives stablecoin payments,
  - emits structured event with reference id,
  - forwards or holds depending on config.
- `TreasurySplitter.sol`
  - simple configurable split routing.

Everything else:

- invoice lifecycle,
- policy engine,
- payouts,
- exports,
- approvals

should stay offchain until demand proves otherwise.

## Data model

### invoices

- id
- entity_id
- customer_id
- public_token
- currency
- amount_minor
- due_at
- memo
- reference_code
- status
- created_at
- updated_at

### customers

- id
- entity_id
- name
- email
- billing_currency
- metadata

### payment_intents

- id
- invoice_id
- accepted_tokens
- settlement_chain
- settlement_wallet
- status
- expires_at

### payments

- id
- invoice_id
- source_chain
- source_tx_hash
- settlement_chain
- settlement_tx_hash
- token
- amount_atomic
- amount_fiat_minor
- payer_address
- received_at
- finalized_at
- status

### ledger_entries

- id
- entity_id
- invoice_id
- payment_id
- type
- debit_account
- credit_account
- amount_minor
- currency
- effective_at

### treasury_rules

- id
- entity_id
- type
- config_json
- enabled

### wallets

- id
- entity_id
- chain
- address
- role

Roles:

- collection
- operating
- reserve
- payout

## Payments flow

### Arc-native path

1. Customer opens invoice link.
2. System creates or loads payment intent.
3. Customer pays in USDC or EURC.
4. Payment event is detected.
5. Arc finality confirms almost immediately.
6. Invoice status changes to paid.
7. Webhook fires to customer system.
8. Treasury rules run.
9. Ledger entries are created.

### Crosschain path

1. Customer pays on supported source chain.
2. System identifies payment and requested settlement route.
3. Funds are bridged or routed to Arc treasury using Circle-aligned path.
4. After Arc-side final settlement, invoice becomes paid.
5. Downstream accounting and treasury logic proceed from Arc as the canonical ledger.

## Monetization

### Pricing model

Start simple:

- monthly platform fee
- plus basis-point fee on processed volume

Recommended initial pricing:

- Starter: $199 per month + 0.20%
- Growth: $799 per month + 0.10%
- Enterprise: custom

Alternative wedge for early adoption:

- free first $10,000 volume
- then 0.25%

Do not underprice if you are solving finance operations pain. This is not a consumer app.

## Go-to-market

### First channel

Founder-led outbound.

Targets:

- web3 agencies,
- stablecoin-friendly SaaS founders,
- ops and finance leads inside remote-first crypto teams,
- treasury and payouts operators at small platforms.

### Message

Do not lead with Arc.

Lead with pain:

"If you receive stablecoin payments from global customers and still reconcile them in spreadsheets, this will save your finance team days per month."

Then explain Arc as the reason the workflow is cleaner:

- instant final settlement,
- predictable gas,
- stablecoin-native treasury center.

### Acquisition loops

- ship a free invoice link generator first
- publish stablecoin invoicing and treasury playbooks
- offer "done-with-you" migration from manual ops
- target Circle ecosystem and grant networks
- integrate with Arc ecosystem channels and community

## First 20 customer profile list

Not exact company names, but the first customer types to chase:

1. Web3 design agency billing US clients in USDC
2. Smart contract studio with international contractors
3. Crypto tax advisory firm receiving client retainers in stablecoins
4. Small SaaS with affiliate payouts in USDC
5. Global dev shop with clients across US, EU, LATAM
6. Research boutique invoicing protocols and DAOs
7. OTC or crypto services firm with manual receivables tracking
8. Creator tools platform paying partners in stablecoins
9. Marketplaces with international vendor balances
10. Treasury-heavy DAO service providers
11. Payroll tooling for contractors paid in stablecoins
12. B2B exporters already using USDC informally
13. LatAm cross-border agency networks
14. African service collectives receiving USD-denominated payments
15. Revshare platforms for partner commissions
16. Stablecoin-native ecommerce back office providers
17. Tokenized asset service firms needing clean settlement records
18. Arc ecosystem grantees with payout and treasury needs
19. Circle alliance partners with manual reconciliation pain
20. Small fintechs exploring stablecoin collections without wanting to build ops tooling themselves

## Defensibility

### Short-term

- best workflow
- best reconciliation UX
- best operator dashboard
- customer-specific migration help

### Medium-term

- proprietary ledger data model for stablecoin AR/AP
- treasury rules engine tuned to real ops workflows
- integrations into accounting and ERP systems
- reputation inside Arc and Circle ecosystem

### Long-term

- become the system of record for stablecoin business payments
- expand from receivables into payables and treasury orchestration
- add compliance and privacy-aware workflows when Arc capabilities mature

## Risks

### Product risk

If stablecoin collections are still too early for your ICP, adoption may lag.

Mitigation:

- target businesses already touching stablecoins
- sell operational savings, not ideology

### Platform risk

Arc mainnet is not live yet as of April 19, 2026.

Mitigation:

- build on testnet now
- architect product so Arc becomes canonical settlement when mainnet is live
- keep wallet and chain adapters modular

### Competitive risk

Circle may release more starter products and managed payment products.

Mitigation:

- stay in the workflow layer, not managed financial infrastructure
- own reconciliation, treasury rules, and finance operations UX

### Regulatory risk

Certain treasury or payout flows may approach regulated territory.

Mitigation:

- begin with software workflow and non-custodial or customer-controlled wallets
- avoid touching fiat early
- get counsel before adding managed settlement or custody-like features

## Why this is still unique despite existing players

There are already products in:

- invoicing,
- wallets,
- payments,
- crosschain treasury,
- stablecoin orchestration.

The opportunity is the intersection:

- invoice-linked collection,
- Arc-native final settlement,
- stablecoin treasury routing,
- accountant-ready reconciliation,
- future refunds and approval workflows.

That intersection is still underbuilt.

## Build order

### Phase 0: 7 days

- landing page
- demo screenshots or Figma
- waitlist
- customer discovery calls
- one live prototype for hosted invoice page

### Phase 1: 2 to 4 weeks

- invoice model
- hosted payment page
- Arc wallet collection
- event ingestion
- invoice auto-close on payment
- CSV export

### Phase 2: 4 to 8 weeks

- Arc treasury dashboard
- split and sweep rules
- customer webhooks
- partial payment handling
- manual resolution queue

### Phase 3: 8 to 12 weeks

- crosschain to Arc settlement path
- payout batches
- reserve wallet policies
- accountant integrations

## What to ship publicly first

Public offer:

"Accept stablecoin B2B payments with invoice-linked reconciliation and Arc-native final settlement."

First public artifact:

- a demo app,
- a short landing page,
- one sample invoice flow,
- one dashboard screenshot showing pending vs paid vs exported.

## Recommended technical starting stack

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ or equivalent
- Viem
- Arc RPC
- Envio or Goldsky later if needed

## Your next concrete move

Build a narrow MVP for one vertical:

"Stablecoin invoices for agencies and service firms."

Why this first:

- fastest validation,
- easiest language,
- shortest path to revenue,
- minimal regulatory surface,
- direct fit with Arc's strengths.

## Final recommendation

If you are building solo on Arc, do this:

Build Stablebooks, an Arc-native B2B receivables and treasury automation platform that helps companies:

- issue invoices,
- collect in stablecoins,
- settle on Arc,
- reconcile automatically,
- and operate treasury without manual spreadsheet work.

This is the cleanest mix of:

- real demand,
- technical feasibility,
- Arc-native advantage,
- and solo-founder execution reality.
