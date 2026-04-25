# Stablebooks Day 15 Secrets / No-Leak Audit

## Document status

- Date: `2026-04-22`
- Scope: `Day 15 Slice 6`
- Status: `completed`

## Purpose

This note records the Day 15 audit for committed secrets, unsafe readiness
responses, and smoke scripts that could accidentally leak production values.

The goal is not to prove that every future deployment is safe by default. The
goal is to make sure the repo currently contains placeholders/dev-only values,
that smoke scripts require runtime env vars for secrets, and that readiness
surfaces do not echo secret values back to operators.

## Scope checked

Checked areas:

- `docs/`
- `apps/api/scripts/`
- `apps/api/src/`
- `apps/web/`

Excluded generated/runtime-heavy areas:

- `node_modules`
- `.next`
- `.next-dev`
- `dist`
- runtime app-store data

## Findings

No committed production Arc/provider/outbound webhook secret was found in the
checked source and docs.

Expected dev/test placeholders are present:

- `stablebooks-dev-arc-key`
- `stablebooks-dev-chain-key`
- `stablebooks-dev-webhook-secret`
- `replace-me`
- seed/dev auth tokens starting with `sb_`
- dummy addresses such as `0x1111111111111111111111111111111111111111`

These values are intentional local/regression fixtures and must not be reused
as shared environment or production credentials.

The production docs use placeholders for sensitive values:

- `DATABASE_URL`
- `ARC_WEBHOOK_SECRET`
- `ARC_RPC_URL`
- `STABLEBOOKS_WEBHOOK_SECRET`
- provider URLs/API keys
- merchant webhook secrets

## Smoke script behavior

Production-like smoke scripts require secrets from environment variables at
runtime rather than embedding production values:

- `apps/api/scripts/smoke-production-flow.js`
- `apps/api/scripts/smoke-arc-webhook.js`

Dry-run output reports presence booleans such as `hasArcWebhookSecret` and
`hasWebhookSecret`; it does not print the secret values.

Regression scripts include dev-only fixture tokens/secrets. Those are scoped to
local test servers and are not production controls.

## Readiness and diagnostics behavior

Arc readiness/dev-state surfaces expose safe config and booleans:

- `hasRpcUrl`
- `hasWebhookSecret`
- source profile fields

They do not expose raw `ARC_RPC_URL` or `ARC_WEBHOOK_SECRET`.

Postgres storage readiness now redacts secret-like connection details from
error responses. If a driver error includes the full `DATABASE_URL` or a
credential-bearing `://user:password@` URL fragment, the readiness response
replaces it before returning JSON.

Provider diagnostics stored in payments/raw payloads are safe operational
metadata:

- provider source
- source profile match result
- rejection reason
- token/contract/profile identifiers

They should not include provider secrets.

## Local `.env` note

A local `apps/api/.env` file exists in the workspace for development. Treat it
as local-only. Production `.env` files and real deployment secrets must stay in
deployment secret storage and out of the repository.

## Residual risks

Future provider integrations may add third-party error strings. Those should be
reviewed before exposing them through readiness, diagnostics, logs, or operator
UI.

Real deployment still needs platform-level secret management, log redaction, and
access control. This audit only covers the repository and current local runtime
surfaces.

## Acceptance

Slice 6 is accepted when:

- production secrets are not committed
- docs use placeholders for sensitive values
- smoke scripts require secrets from env vars
- readiness surfaces expose booleans/safe config, not raw secrets
- Postgres readiness redacts connection secrets from error messages
