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

The initial Day 19 status check correctly found that hosted targets were not
yet provisioned in local repo context.

That blocker is now cleared.

What is now confirmed:

- hosted Web URL:
  `https://stablebooks-web-production.up.railway.app`
- hosted API URL:
  `https://stablebooks-api-production.up.railway.app/api/v1`
- managed Postgres target:
  Railway Postgres attached to project `stablebooks-staging`
- provider webhook target:
  `https://stablebooks-api-production.up.railway.app/api/v1/arc/webhooks/events`
- provider finality target:
  `https://stablebooks-api-production.up.railway.app/api/v1/arc/webhooks/finality`
- outbound merchant webhook mode:
  `disabled`

## Evidence found

### Provisioned hosted stack

Hosted staging is now provisioned on Railway as:

- project: `stablebooks-staging`
- service: `stablebooks-api`
- service: `stablebooks-web`
- service: `Postgres`

### Deployed URLs

- Web: `https://stablebooks-web-production.up.railway.app`
- API: `https://stablebooks-api-production.up.railway.app/api/v1`

## What this means

Day 19 is no longer blocked on target provisioning.

Hosted rehearsal execution can proceed directly against the confirmed Railway
targets.

## Recommended first-hosted target posture

For the first rehearsal, the target set is now:

- Web host: `https://stablebooks-web-production.up.railway.app`
- API host: `https://stablebooks-api-production.up.railway.app/api/v1`
- managed Postgres: `Railway Postgres`
- provider webhook target:
  - `https://stablebooks-api-production.up.railway.app/api/v1/arc/webhooks/events`
  - `https://stablebooks-api-production.up.railway.app/api/v1/arc/webhooks/finality`
- outbound merchant webhook mode:
  - `disabled` for the first hosted run

## Output of this slice

Slice 2 remains complete, and the staging target note is now updated with the
actual provisioned hosted targets used in the rehearsal.

## Next step

Proceed with hosted rehearsal execution and hardening on the confirmed Railway
targets.
