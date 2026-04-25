# Stablebooks Day 19 Acceptance Note

## Status

Accepted on `2026-04-25`.

## Acceptance statement

Day 19 is complete.

Stablebooks now has a verified first hosted staging rehearsal on Railway with:

- hosted API deploy
- hosted Web deploy
- managed Postgres runtime
- staging bootstrap through product APIs
- passing hosted API smoke
- passing hosted Web smoke

## Important outcome

The rehearsal also surfaced and fixed a real production-shape issue:

- bootstrap domain writes were still split between JSON and Postgres

That issue is now bridged for hosted staging, which materially reduces the gap
between local rehearsal and hosted runtime behavior.

## Remaining recommendation

Next, move to Day 20: reduce manual staging setup and harden the hosted path
for repeated rehearsals.

Recommended focus:

- staging bootstrap/runbook automation
- env cleanup and secret rotation after first hosted run
- reducing the remaining JSON/auth split where it affects operator lifecycle
