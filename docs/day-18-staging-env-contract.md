# Stablebooks Day 18 Staging Env Contract

## Document status

- Date: `2026-04-25`
- Scope: `Day 18 Slice 3`
- Status: `draft`

## Purpose

This note defines the exact environment contract for the first hosted staging
deployment.

The goal is to make staging setup deterministic:

- which variables are required
- which values are secrets
- which values are safe config
- which values belong to Web vs API
- which values are used only during smoke runs

## Staging runtime target

Hosted staging should run in the same production-like posture already proven in
local rehearsal:

```env
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
```

## Variable classes

Use these categories consistently:

- secret
- safe config
- smoke-only
- local/dev-only

Secrets must live only in deployment secret storage.

Safe config may live in hosted environment settings and docs with placeholders.

Smoke-only values should be injected only during verification runs, not treated
as permanent runtime config.

Local/dev-only values should not be part of hosted staging unless there is an
explicit temporary reason.

## API variables

### Required secrets

`DATABASE_URL`

- Type: `secret`
- Required: yes
- Owner: API
- Purpose: managed Postgres connection string
- Rule: must point only to the staging database

`ARC_WEBHOOK_SECRET`

- Type: `secret`
- Required: yes when `ARC_SOURCE_ENABLED=true` and `ARC_SOURCE_KIND=webhook`
- Owner: API
- Purpose: authenticates inbound provider webhook calls
- Rule: must not match `STABLEBOOKS_WEBHOOK_SECRET`

`STABLEBOOKS_WEBHOOK_SECRET`

- Type: `secret`
- Required: yes only if outbound merchant webhook delivery is enabled
- Owner: API
- Purpose: signs outbound Stablebooks webhook payloads
- Rule: leave unset only when outbound delivery is intentionally disabled

### Required safe config

`PORT`

- Type: `safe config`
- Required: platform-dependent
- Owner: API
- Purpose: API listen port inside the hosting runtime
- Note: some platforms inject this automatically

`STABLEBOOKS_STORAGE_MODE`

- Type: `safe config`
- Required: yes
- Expected staging value: `postgres_reads`

`STABLEBOOKS_INVOICE_WRITE_MODE`

- Type: `safe config`
- Required: yes
- Expected staging value: `postgres`

`STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE`

- Type: `safe config`
- Required: yes
- Expected staging value: `postgres`

`STABLEBOOKS_MATCHING_WRITE_MODE`

- Type: `safe config`
- Required: yes
- Expected staging value: `postgres`

`STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE`

- Type: `safe config`
- Required: yes
- Expected staging value: `postgres`

`STABLEBOOKS_WEBHOOK_WRITE_MODE`

- Type: `safe config`
- Required: yes
- Expected staging value: `postgres`

`ARC_SOURCE_ENABLED`

- Type: `safe config`
- Required: yes
- Expected staging value: `true`

`ARC_SOURCE_KIND`

- Type: `safe config`
- Required: yes
- Expected staging value: `webhook`

`ARC_CHAIN_ID`

- Type: `safe config`
- Required: yes
- Expected first staging value: `5042002`

`ARC_EVENT_MONITOR_SOURCE`

- Type: `safe config`
- Required: yes
- Expected first staging value: `circle_contracts_api`

`ARC_EVENT_CONTRACT_ADDRESS`

- Type: `safe config`
- Required: yes
- Purpose: monitored token/contract address for provider payload validation

`ARC_EVENT_SIGNATURE`

- Type: `safe config`
- Required: yes
- Expected first staging value: `Transfer(address,address,uint256)`

`ARC_EVENT_TOKEN_SYMBOL`

- Type: `safe config`
- Required: yes
- Expected first staging value: `USDC`

`ARC_EVENT_TOKEN_DECIMALS`

- Type: `safe config`
- Required: yes
- Expected first staging value: `6`

`STABLEBOOKS_WEBHOOK_URL`

- Type: `safe config`
- Required: no
- Owner: API
- Purpose: outbound merchant webhook destination
- Rule: empty value is valid and means disabled delivery records are expected

`STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS`

- Type: `safe config`
- Required: no
- Default in code: `4`

`STABLEBOOKS_WEBHOOK_RETRY_BASE_MS`

- Type: `safe config`
- Required: no
- Default in code: `5000`

`STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS`

- Type: `safe config`
- Required: no
- Default in code: `3000`

## Web variables

### Required safe config

`API_BASE_URL`

- Type: `safe config`
- Required: yes
- Owner: Web
- Purpose: Next.js server-side calls into hosted API
- Example:
  `https://staging-api.example.com/api/v1`
- Rule: must never include credentials

### Not allowed on Web

These must not exist in the Web deployment:

- `DATABASE_URL`
- `ARC_WEBHOOK_SECRET`
- `STABLEBOOKS_WEBHOOK_SECRET`

## Smoke variables

These are not permanent application runtime config. They are used only when
running smoke scripts against staging.

### API production flow smoke

`SMOKE_API_BASE_URL`

- Type: `smoke-only`
- Required: yes
- Example:
  `https://staging-api.example.com/api/v1`

`SMOKE_OPERATOR_TOKEN`

- Type: `smoke-only`
- Required: yes
- Purpose: authenticated operator access for API smoke

`SMOKE_CUSTOMER_ID`

- Type: `smoke-only`
- Required: yes

`SMOKE_SETTLEMENT_WALLET`

- Type: `smoke-only`
- Required: yes

Optional smoke values:

- `SMOKE_AMOUNT_MINOR`
- `SMOKE_CURRENCY`
- `SMOKE_MEMO`
- `SMOKE_INTERNAL_NOTE`
- `SMOKE_DUE_AT`
- `ARC_SMOKE_TX_HASH`
- `ARC_SMOKE_BLOCK_NUMBER`
- `ARC_SMOKE_CONFIRMED_AT`
- `ARC_SMOKE_FROM`
- `ARC_SMOKE_AMOUNT_ATOMIC`

### Web production UI smoke

`SMOKE_WEB_BASE_URL`

- Type: `smoke-only`
- Required: yes
- Example:
  `https://staging-web.example.com`

`SMOKE_OPERATOR_TOKEN`

- Type: `smoke-only`
- Required: yes
- Shared with API smoke if desired

`SMOKE_INVOICE_ID`

- Type: `smoke-only`
- Required: yes

`SMOKE_PAYMENT_ID`

- Type: `smoke-only`
- Required: yes

`SMOKE_PUBLIC_TOKEN`

- Type: `smoke-only`
- Required: yes

Optional:

- `SMOKE_EXPECTED_TX_HASH`
- `SMOKE_EXPECTED_WEBHOOK_STATUS`
- `SMOKE_EXPECTED_INVOICE_STATUS`
- `SMOKE_EXPECTED_PAYMENT_STATUS`

## Local/dev-only values

These should not be the hosted staging contract:

`ARC_DEV_INGEST_KEY`

- local/shared-dev helper only
- not provider webhook auth

`stablebooks-dev-arc-key`

- development fallback only

`stablebooks-dev-webhook-secret`

- development fallback only

Local `.env` files with plaintext secrets are also not part of the hosted
staging contract.

## Minimal staging env set

### API

```env
DATABASE_URL=<managed-postgres-url>
STABLEBOOKS_STORAGE_MODE=postgres_reads
STABLEBOOKS_INVOICE_WRITE_MODE=postgres
STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE=postgres
STABLEBOOKS_MATCHING_WRITE_MODE=postgres
STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE=postgres
STABLEBOOKS_WEBHOOK_WRITE_MODE=postgres
ARC_SOURCE_ENABLED=true
ARC_SOURCE_KIND=webhook
ARC_CHAIN_ID=5042002
ARC_WEBHOOK_SECRET=<secret-from-secret-store>
ARC_EVENT_MONITOR_SOURCE=circle_contracts_api
ARC_EVENT_CONTRACT_ADDRESS=<contract-address>
ARC_EVENT_SIGNATURE=Transfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=6
STABLEBOOKS_WEBHOOK_URL=
```

### Web

```env
API_BASE_URL=https://staging-api.example.com/api/v1
```

## Secret handling rules

Never commit:

- `DATABASE_URL`
- `ARC_WEBHOOK_SECRET`
- `STABLEBOOKS_WEBHOOK_SECRET`
- provider URLs with embedded API keys
- production/staging `.env` files

Never echo back in readiness/logging responses:

- raw database URL
- raw Arc webhook secret
- raw outbound webhook secret
- raw operator token

Safe to document with placeholders:

- env var names
- public hostnames
- chain id
- public contract address placeholders
- token symbol and decimals

## First staging recommendation

For the first hosted staging run:

- keep outbound merchant webhook disabled unless a receiver already exists
- keep secrets only in hosting secret storage
- keep Web config minimal with only `API_BASE_URL`
- keep all smoke IDs/tokens injected at run time

## Output of this slice

Stablebooks now has a hosted staging env contract that separates:

- API secrets
- API safe runtime config
- Web safe runtime config
- smoke-only inputs
- local/dev-only values that should not leak into staging

## Next step

Proceed to Day 18 Slice 4:

- define migration, seed, and operator bootstrap strategy for staging
