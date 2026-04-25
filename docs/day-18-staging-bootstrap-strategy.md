# Stablebooks Day 18 Staging Bootstrap Strategy

## Document status

- Date: `2026-04-25`
- Scope: `Day 18 Slice 4`
- Status: `draft`

## Purpose

This note defines how staging is initialized safely:

- how migrations are applied
- whether seed data is used
- how the first operator account is created
- how the first organization, settlement wallet, and smoke customer are created

The goal is to avoid destructive shortcuts once staging is shared.

## Recommended principle

Use migrations for schema.

Use API/bootstrap flows for data.

Do not treat the current local seed script as the normal staging bootstrap path.

## Migrations strategy

### Required approach

Apply Prisma migrations before the API receives real staging traffic.

Recommended command:

```powershell
corepack pnpm --filter @stablebooks/api exec prisma migrate deploy
```

Why:

- it uses committed migration history
- it is reproducible from a clean database
- it matches the intended deployment model better than `migrate dev`

### Not recommended in hosted staging

Do not use this in the normal staging rollout:

```powershell
corepack pnpm --filter @stablebooks/api db:migrate:dev
```

Reason:

- it is a development workflow
- it can create drift or interactive assumptions
- it is not the clean “apply existing migrations only” posture we want

## Seed strategy

### Current repo reality

Current seed script:

```text
apps/api/prisma/seed.js
```

Important behavior:

- it deletes existing rows from core runtime tables before recreating fixtures
- it creates local/demo credentials and IDs
- it is useful for disposable local rehearsal
- it is not safe as a repeatable shared-staging bootstrap once people rely on data

### Staging recommendation

For the first hosted staging deployment:

- do not run `db:seed` automatically on every deploy
- do not use destructive seed on a shared staging database
- use API-driven bootstrap for long-lived staging data

### When seed is acceptable

`db:seed` is acceptable only if all of these are true:

- the staging database is brand new or intentionally disposable
- no one depends on existing staging data
- we explicitly want demo fixtures instead of a clean bootstrap

Even then, treat it as a one-time setup shortcut, not as the normal staging
operating model.

## Operator bootstrap strategy

### Recommended path

Create the first operator through the existing auth API:

1. `POST /api/v1/auth/signup`
2. capture returned bearer token
3. use that token for the rest of the bootstrap steps

Reason:

- this matches the real product path
- no direct database writes are required
- it avoids hardcoded seed credentials in hosted staging

### Example bootstrap order

1. create operator account
2. create organization
3. create default settlement wallet
4. create smoke customer
5. sign in again and capture reusable operator token for smoke

### Sign-up payload

```json
{
  "email": "operator@staging.stablebooks.local",
  "password": "replace-with-long-random-password",
  "name": "Stablebooks Staging Operator"
}
```

This exact email is only an example. Use a staging-specific operator email.

## Organization bootstrap strategy

After signup, create the first organization through:

```text
POST /api/v1/organizations
```

Recommended first values:

```json
{
  "name": "Stablebooks Staging Org",
  "billingCountry": "US",
  "baseCurrency": "USD"
}
```

Expected result:

- operator becomes admin of the org
- onboarding moves to `pending_wallet`

## Settlement wallet bootstrap strategy

Create the first settlement wallet through:

```text
POST /api/v1/wallets
```

Recommended shape:

```json
{
  "chain": "arc",
  "address": "<staging-settlement-wallet-address>",
  "label": "Primary Arc Staging Collection",
  "role": "collection",
  "isDefaultSettlement": true
}
```

Requirements:

- use a staging-only collection address
- do not reuse a production settlement wallet
- this wallet becomes the target used by payment session creation and matching

Expected result:

- onboarding becomes `completed`
- hosted payment flows now have a default settlement destination

## Smoke customer bootstrap strategy

Create the first smoke customer through:

```text
POST /api/v1/customers
```

Recommended shape:

```json
{
  "name": "Acme Staging Treasury",
  "email": "ap@staging-acme.local",
  "billingCurrency": "USD",
  "metadata": {
    "segment": "staging-smoke",
    "source": "day-18-bootstrap"
  }
}
```

Why this matters:

- `smoke:production-flow` needs a real customer id
- keeping one stable smoke customer makes repeated staging verification easier

## Token strategy for smoke runs

Do not hardcode a long-lived seed token into hosted staging docs.

Instead:

1. sign in through `POST /api/v1/auth/signin`
2. capture the returned token
3. inject that token into:
   - `SMOKE_OPERATOR_TOKEN` for API smoke
   - `SMOKE_OPERATOR_TOKEN` for Web smoke

Recommended posture:

- create one staging operator account
- rotate/reset the password if it leaks
- fetch a fresh session token before important smoke runs

## First hosted staging bootstrap sequence

Recommended order:

1. provision managed Postgres
2. apply migrations with `prisma migrate deploy`
3. deploy API with Postgres-backed flags and Arc webhook config
4. verify API readiness
5. create operator with `POST /auth/signup`
6. create org with `POST /organizations`
7. create settlement wallet with `POST /wallets`
8. create smoke customer with `POST /customers`
9. sign in and capture operator token
10. run staging smoke flow

## What not to do

Avoid these patterns in shared staging:

- running destructive `db:seed` after people already use the environment
- direct manual table edits for normal bootstrap
- reusing local dev tokens in hosted staging
- reusing production wallet addresses
- mixing production and staging webhook secrets

## Optional future improvement

After the first hosted staging deployment, we should add a dedicated
non-destructive bootstrap command such as:

- `bootstrap:staging`

That command should:

- be idempotent
- create-or-reuse operator/org/wallet/customer records
- avoid deleting existing runtime data
- print only safe bootstrap output

That is a follow-up improvement, not a blocker for the first staging run.

## Output of this slice

Stablebooks now has a clear staging initialization policy:

- schema via Prisma migrations
- data bootstrap via API flows
- destructive seed reserved only for disposable environments

## Next step

Proceed to Day 18 Slice 5:

- create the step-by-step staging deployment checklist
