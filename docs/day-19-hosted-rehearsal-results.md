# Stablebooks Day 19 Hosted Rehearsal Results

## Document status

- Date: `2026-04-25`
- Scope: `First hosted staging rehearsal`
- Status: `completed`

## Hosted targets used

- Web: `https://stablebooks-web-production.up.railway.app`
- API: `https://stablebooks-api-production.up.railway.app/api/v1`
- Infra: Railway project `stablebooks-staging`
- Database: Railway Postgres

## Deployment result

- API deployed successfully through Railway Docker build
- Web deployed successfully through Railway Docker build
- Postgres-backed readiness is green
- `jsonStoreActive=false`
- all payment-domain write modes are set to `postgres`

## Bootstrap result

Hosted bootstrap was executed through API flows:

- operator signup
- organization creation
- default settlement wallet creation
- smoke customer creation

Credentials and tokens used during the rehearsal were intentionally not written
into repository docs.

## Issues found during rehearsal

### Issue 1: API Docker build failed on first attempt

Root cause:

- Prisma client generation was not happening inside the clean Linux container

Fix:

- API Dockerfile now runs `prisma generate` before `nest build`

### Issue 2: bootstrap domains were split across JSON and Postgres

Root cause:

- `organizations`, `wallets`, and `customers` bootstrap endpoints still wrote
  only into the JSON store
- `invoices`, matching, and terminal payment runtime already depended on
  Postgres-backed state

Impact:

- hosted bootstrap looked successful from API responses
- `POST /invoices` failed because the selected customer did not exist in
  Postgres

Fix:

- bootstrap domain services now bridge organization, wallet, and customer data
  into Postgres when the runtime is running in `postgres_reads`

## Hosted API smoke result

`smoke:production-flow` passed against Railway staging.

Verified:

- invoice creation
- hosted payment session creation
- Arc webhook event ingestion
- exact payment matching
- finality confirmation
- payment finalization
- webhook delivery record creation

Observed final outcome:

- invoice status: `paid`
- payment status: `finalized`
- match result: `exact`
- webhook delivery status: `disabled`

`disabled` is expected for this first hosted run because outbound merchant
destination is not configured yet.

## Hosted Web smoke result

`smoke:production-ui` passed against Railway staging.

Verified routes:

- `/signin`
- `/dashboard`
- `/invoices/<invoiceId>`
- `/payments/<paymentId>`
- `/webhooks?queue=all`
- `/pay/<publicToken>`

Verified UI behavior:

- operator routes render hosted staging data
- invoice and payment detail show finalized payment state
- webhook queue shows disabled delivery state
- hosted public pay page does not leak operator diagnostics

## Result

Day 19 achieved the first real hosted staging rehearsal:

- deploy works
- bootstrap works
- API flow smoke works
- Web smoke works

The product is now beyond local-only rehearsal and has a confirmed hosted
staging path.
