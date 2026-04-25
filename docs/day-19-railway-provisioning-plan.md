# Stablebooks Day 19 Railway Provisioning Plan

## Document status

- Date: `2026-04-25`
- Scope: `Concrete hosted staging provisioning plan`
- Status: `draft`

## Chosen stack

Use **Railway** for the first hosted staging rehearsal:

- one Railway project
- one Railway Postgres database
- one Railway API service
- one Railway Web service

## Why Railway

Railway is the best single-stack fit for Stablebooks right now because it
matches the current repo shape with the least operational overhead.

Reasons:

- Railway officially supports JavaScript monorepos and can automatically import
  deployable packages from `pnpm` monorepos.
- Railway officially supports deploying Next.js apps and attaching Postgres.
- Railway supports reference variables for `DATABASE_URL`.
- Railway supports pre-deploy commands for migrations.
- Railway gives us Web, API, and Postgres in one hosted platform for the first
  rehearsal.

Official sources used for this decision:

- Monorepo support:
  `https://docs.railway.com/deployments/monorepo`
- Next.js + Postgres:
  `https://docs.railway.com/guides/nextjs`
- Build/start overrides:
  `https://docs.railway.com/reference/build-and-start-commands`
- Pre-deploy command:
  `https://docs.railway.com/guides/pre-deploy-command`
- Pricing:
  `https://docs.railway.com/pricing`

## Pricing posture

As checked on `2026-04-25`:

- Free trial: one-time `$5` credits for new users
- Hobby: `$5/month`
- Hobby includes `$5` monthly usage

For a solo MVP rehearsal, this is a reasonable first paid platform if we want
to keep setup simple and colocated.

Recheck pricing before entering card details.

## Target Railway layout

Create one Railway project:

- `stablebooks-staging`

Inside it, create or import three resources:

1. `stablebooks-web`
2. `stablebooks-api`
3. `stablebooks-postgres`

## Recommended provisioning path

Use **GitHub import**, not ad hoc CLI deploys, as the canonical setup.

Reason:

- Railway documents automatic import for JavaScript monorepos
- the current workspace does not contain a local `.git` directory
- we need repeatable hosted deployments, not one-off uploads

So the practical Step 0 is:

1. initialize/publish this project to GitHub
2. import that repo into Railway
3. let Railway detect deployable monorepo services

## Step 0: GitHub prerequisite

Before Railway provisioning:

- create a GitHub repo for `Stablebooks`
- push the current monorepo to GitHub

Without that, Railway can still deploy via CLI, but the clean Day 19 hosted
staging path becomes less repeatable.

## Step 1: create Railway project

In Railway:

1. Create a new project.
2. Choose GitHub repo import.
3. Select the Stablebooks repository.

Expected result:

- Railway recognizes this as a JavaScript monorepo
- Railway stages deployable services

## Step 2: create the three resources

### Postgres

Add:

- `Database -> PostgreSQL`

Name it:

- `stablebooks-postgres`

### API

Create/import service:

- `stablebooks-api`

### Web

Create/import service:

- `stablebooks-web`

## Step 3: service configuration

### API service

Service name:

- `stablebooks-api`

Recommended source:

- root repo import with workspace-aware commands

Recommended build command:

```text
corepack pnpm --filter @stablebooks/api build
```

Recommended start command:

```text
corepack pnpm --filter @stablebooks/api start
```

Recommended pre-deploy command:

```text
corepack pnpm --filter @stablebooks/api exec prisma migrate deploy
```

Recommended watch paths:

- `/apps/api/**`
- `/packages/**`
- `/package.json`
- `/pnpm-lock.yaml`
- `/pnpm-workspace.yaml`
- `/tsconfig.base.json`

### Web service

Service name:

- `stablebooks-web`

Recommended build command:

```text
corepack pnpm --filter @stablebooks/web build
```

Recommended start command:

```text
corepack pnpm --filter @stablebooks/web start
```

Recommended watch paths:

- `/apps/web/**`
- `/packages/**`
- `/package.json`
- `/pnpm-lock.yaml`
- `/pnpm-workspace.yaml`
- `/tsconfig.base.json`

### Postgres service

Use Railway-managed defaults.

Then expose `DATABASE_URL` to the API service using a **reference variable**
from the Postgres service.

## Step 4: domains

Generate public Railway domains for:

- `stablebooks-api`
- `stablebooks-web`

Expected target shape:

- API:
  `https://stablebooks-api-production.up.railway.app`
- Web:
  `https://stablebooks-web-production.up.railway.app`

These exact hostnames are examples. Railway will generate the real values.

## Step 5: API environment variables

Set on `stablebooks-api`:

### Required secret/reference values

`DATABASE_URL`

- reference variable from `stablebooks-postgres`

`ARC_WEBHOOK_SECRET`

- generate a fresh staging-only secret

`STABLEBOOKS_WEBHOOK_SECRET`

- generate a fresh staging-only secret only if outbound merchant webhook is
  enabled

### Required runtime flags

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=<staging-contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
STABLEBOOKS_WEBHOOK_URL=
```

For the first hosted run, keep:

```env
STABLEBOOKS_WEBHOOK_URL=
```

That keeps outbound merchant delivery intentionally disabled.

## Step 6: Web environment variables

Set on `stablebooks-web`:

```env
API_BASE_URL=https://<real-api-domain>/api/v1
```

Nothing else should be required on Web for the first hosted rehearsal.

Do not place on Web:

- `DATABASE_URL`
- `ARC_WEBHOOK_SECRET`
- `STABLEBOOKS_WEBHOOK_SECRET`

## Step 7: repo preflight before first Railway deploy

### Strong recommendation

Before the first hosted Web deploy, update the Next.js config to use:

```ts
output: "standalone"
```

Why:

- Railway's official Next.js guide recommends standalone output for self-hosted
  deployment
- the current repo does **not** set standalone output yet

Current file:

- `apps/web/next.config.mjs`

This is not a blocker for writing the provisioning plan, but it is the first
repo-level deployment hardening I would do before the actual Railway rollout.

## Step 8: Day 19 execution order on Railway

Once the project is provisioned:

1. apply `DATABASE_URL` reference to API
2. load API env contract
3. load Web `API_BASE_URL`
4. deploy API
5. verify:
   - `/api/v1/health/live`
   - `/api/v1/health/storage`
6. deploy Web
7. verify `/signin`
8. bootstrap operator/org/wallet/customer
9. run `smoke:production-flow`
10. run `smoke:production-ui`

## Definition of done for provisioning

Provisioning is done when all of these are true:

- GitHub repo exists
- Railway project exists
- Railway Postgres exists
- Railway API service exists
- Railway Web service exists
- API has a Railway domain
- Web has a Railway domain
- API has `DATABASE_URL` reference wired
- API env contract is loaded
- Web `API_BASE_URL` is loaded

## What remains blocked after this document

This plan does not itself provision Railway.

It only fixes the exact target stack and setup path.

To continue Day 19 in practice, the next real-world action is:

1. push Stablebooks to GitHub
2. create the Railway project
3. provision the three Railway resources

## Recommended next step

After accepting this stack decision, continue with:

- GitHub repo creation for Stablebooks
- then Railway project provisioning
