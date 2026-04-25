# Stablebooks Day 26 Production Readiness Gaps

## Document status

- Date: `2026-04-25`
- Scope: `Day 26 Slice 2`
- Status: `accepted`

## Purpose

This document separates the accepted Day 25 MVP baseline from the remaining
work required before a real production launch.

The goal is not to reopen MVP scope. The goal is to make the production gap
visible and operationally safe.

## Already MVP-ready

Stablebooks is already accepted for hosted staging/demo use with:

- Railway-hosted API and Web
- Postgres-backed hosted runtime
- hosted runtime policy guardrails
- operator auth and app shell
- organization, wallet, customer, invoice, payment flows
- public payment page
- Arc webhook-first provider boundary
- provider source profile validation
- Arc-shaped event ingestion rehearsal
- payment matching and terminal finality
- webhook delivery queue, retry, replay, and dead-letter surfaces
- operator runtime readiness visibility
- canonical hosted staging rehearsal

## Production blockers

These must be resolved before calling the system production-launched.

### Real Arc/Circle provider access

The MVP has an Arc/Circle-shaped webhook boundary, but production launch needs
real provider setup:

- real Circle/Event Monitor or equivalent provider configuration
- final monitored contract or token address
- final event signature and token profile
- deployment secret value for `ARC_WEBHOOK_SECRET`
- one real provider-delivered event reaching the hosted API
- operator-visible evidence for the resulting payment

### Real merchant outbound webhook destination

Current hosted staging has outbound webhooks intentionally disabled.

Production launch needs:

- real merchant webhook destination URL
- independent `STABLEBOOKS_WEBHOOK_SECRET`
- successful `payment.finalized` delivery
- failed delivery retry behavior verified
- replay behavior verified
- dead-letter handling verified

### Production domain and routing

Railway staging URLs are acceptable for MVP demo, but production launch needs:

- production API domain
- production Web domain
- provider webhook URL pointed at the production API domain
- public payment pages served from the production Web domain
- TLS verified on both domains

### Production operations baseline

Before production launch, the operator needs:

- deployment owner and incident owner
- secret rotation procedure
- Postgres backup/restore posture
- runtime health monitoring
- basic alerting for API down, Postgres unreachable, and provider ingestion
  failures
- rollback owner and rollback decision rule

## Production non-blockers

These are important but can remain post-launch if the first launch is controlled
and low-volume.

- billing and pricing automation
- advanced merchant team management
- custom merchant branding
- RPC/indexer polling mode
- multi-region deployment
- advanced analytics
- automated provider credential rotation

## External launch dependencies

These cannot be completed by code changes alone:

- provider account access
- provider event monitor configuration
- final Arc network/token contract details
- production DNS ownership
- merchant webhook receiver infrastructure
- production incident/monitoring tool choice

## Recommended launch posture

Use a controlled production launch:

- one Railway stack
- one Postgres database
- webhook-first Arc ingestion
- one monitored token/contract profile
- one merchant webhook destination
- low-volume first customer/demo merchant
- rollback through feature flags, not data deletion

## No-go conditions

Do not launch production if any of these are true:

- `/api/v1/health/runtime` is not green
- hosted runtime policy is not `policyOk=true`
- Postgres is not reachable
- Arc readiness is not `ready=true`
- provider payloads cannot be authenticated
- provider source profile is not final
- outbound merchant webhook destination is missing for a launch that promises
  merchant notifications
- rollback owner is not defined
- production secrets are committed or copied into docs

## Day 26 conclusion

The remaining work is not more MVP product scope. It is production launch
operations, real provider verification, and real merchant delivery setup.
