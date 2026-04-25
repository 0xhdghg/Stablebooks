# Stablebooks Day 23 Fallback Policy

## Policy summary

Stablebooks keeps JSON fallback as a fallback capability, but not as a silent
hosted runtime mode.

## Hosted-mode rule

Hosted environments should normally run only with:

- `STABLEBOOKS_STORAGE_MODE=postgres_reads`
- all payment-domain write modes = `postgres`

If hosted runtime falls back away from that posture, it is considered unsafe
unless explicitly allowed.

## Explicit hosted override

Hosted fallback is allowed only through:

```env
STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=true
```

This is intended for temporary emergency rollback only.

## Enforcement behavior

Default hosted behavior is enforced.

If hosted runtime is detected and the runtime posture is not Postgres-backed:

- startup fails by default
- unless the explicit hosted fallback override is enabled

Optional enforcement disable:

```env
STABLEBOOKS_ENFORCE_HOSTED_RUNTIME_POLICY=false
```

This exists for exceptional operator control, not as the standard path.

## Health visibility

`/api/v1/health/storage` now exposes:

- `hostedRuntimePolicy.hostedDetected`
- `hostedRuntimePolicy.platform`
- `hostedRuntimePolicy.policyOk`
- `hostedRuntimePolicy.allowHostedJsonFallback`
- `hostedRuntimePolicy.enforcementEnabled`
- `hostedRuntimePolicy.reasons`

## Outcome

Day 23 makes hosted fallback explicit, inspectable, and much harder to trigger
accidentally.
