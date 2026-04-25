# Stablebooks Day 19 Staging Targets Status

## Document status

- Date: `2026-04-25`
- Scope: `Day 19 Slice 2`
- Status: `completed`

## Purpose

This note captures the current truth about hosted staging targets before the
first hosted rehearsal.

The goal of this slice was to confirm whether real hosted targets already
exist.

## Confirmed current status

At the time of this check, real hosted staging targets are **not yet confirmed
or provisioned** in the repository/local workspace context.

What is confirmed:

- no real hosted Web URL is present in repo config
- no real hosted API URL is present in repo config
- no managed staging Postgres URL is present in repo config
- no hosting platform config file is present in repo root
- no local `.git` directory is present in the project folder
- current root `.env` and `.env.example` are local-development oriented

## Evidence found

### Local-only env posture

Current root `.env` contains only local examples such as:

- `APP_BASE_URL=http://localhost:3000`
- `API_BASE_URL=http://localhost:4000`
- local `DATABASE_URL`

Current `.env.example` also contains only local placeholders.

### No hosted deployment config in repo

No first-party deployment config files were found for common hosting targets:

- `vercel.json`
- `render.yaml`
- `railway.json`
- `fly.toml`

### No real staging URLs in docs/config

Day 18 docs intentionally use placeholders such as:

- `https://staging-web.example.com`
- `https://staging-api.example.com`

These are planning placeholders, not confirmed live targets.

## What this means

Day 19 can proceed only after real hosted targets are provisioned or provided.

This is now the main external blocker for:

- Slice 3: hosted Postgres migration
- Slice 4: hosted API deploy
- Slice 5: hosted Web deploy
- Slice 6+: bootstrap and smoke against hosted staging

## Recommended first-hosted target posture

For the first rehearsal, the recommended target set remains:

- Web host: `TBD`
- API host: `TBD`
- managed Postgres: `TBD`
- provider webhook target:
  - `https://<staging-api-host>/api/v1/arc/webhooks/events`
  - `https://<staging-api-host>/api/v1/arc/webhooks/finality`
- outbound merchant webhook mode:
  - `disabled` for the first hosted run unless a receiver already exists

## External prerequisites now needed

To continue Day 19, we need actual values for:

- staging Web URL
- staging API URL
- managed Postgres target
- deployment secret storage
- final decision on outbound webhook mode

## Output of this slice

Slice 2 is complete because the current deployment posture has been confirmed:

- hosted targets are not yet provisioned in this workspace context
- Day 19 can continue once those targets exist

## Next step

Proceed to Day 19 Slice 3 only after provisioning or receiving the real hosted
staging targets.
