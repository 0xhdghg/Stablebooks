# AGENT_RULES.md

## Project Mode

This project is executed strictly through day-based execution plans.

- Each `docs/day-XX-execution-plan.md` is the main execution contract.
- The current project status is:
  - Day 24 completed
  - next step is Day 25
- Before making changes, read:
  - `README.md`
  - the current day execution plan
  - the latest acceptance and hosted verification notes for that day

## Source Of Truth Hierarchy

When making decisions, use this priority:

1. `docs/day-XX-execution-plan.md`
2. `docs/day-XX-acceptance-note.md`
3. `docs/day-XX-hosted-verification.md`
4. existing codebase
5. `README.md` for context only

If a conflict exists, follow the execution plan.

## Core Behavior

The agent must behave as a strict executor of the current plan.

The agent is not acting as:

- a system redesign engine
- a speculative optimizer
- a refactoring engine

## Architecture Rules

- Do not change architecture unless explicitly instructed.
- Do not introduce new patterns, frameworks, abstractions, or dependencies unless explicitly required.
- Do not refactor for cleanliness, elegance, or best-practice preference alone.
- Preserve the existing structure:
  - `apps/api`
  - `apps/web`
- Respect the current runtime model:
  - Postgres-backed hosted runtime
  - JSON fallback
  - feature flags
  - hosted runtime guardrails

## Implementation Rules

- Work incrementally.
- Make the smallest change that satisfies the current step.
- Do not rewrite working areas.
- Do not anticipate future tasks unless the current plan explicitly requires it.
- Do not optimize beyond the current requirement.
- Preserve existing behavior unless the current task explicitly changes it.

## Feature Flag Discipline

- All new behavior must respect existing feature flags and runtime policies.
- Do not remove fallback paths unless the plan explicitly calls for it.
- Do not bypass runtime guards, hosted policy checks, or rollout protections.

## Hosted And Staging Discipline

- Treat hosted staging as the canonical runtime baseline.
- Do not introduce local-only shortcuts into hosted flows.
- Follow the current env contracts, readiness endpoints, and deployment assumptions.
- If a change affects hosted runtime behavior, verify it against the existing hosted posture rather than assuming local behavior is sufficient.

## Code Change Constraints

When changing code:

- keep changes minimal and scoped
- do not rename modules, files, or functions unless required
- do not move files unless required
- do not break existing API contracts
- do not change data shape unless required by the current step

## Documentation Discipline

- Do not rewrite or reorganize docs unless explicitly required.
- Only update docs that are relevant to the current execution step.
- Keep docs aligned with the actual implementation and current day status.
- Do not create speculative roadmap docs during execution work unless requested.

## When Unsure

If ambiguity exists:

- prefer the minimal safe assumption
- stay consistent with existing patterns
- stay aligned with the current execution plan
- ask for clarification only if the ambiguity could cause incorrect implementation or a hidden architectural change

## Explicitly Forbidden

- architectural redesign
- speculative cleanup
- large refactors
- introducing new dependencies without request
- changing data models outside the current plan
- reinterpreting requirements into broader work
- silently widening scope

## Command Override Rule

If the user gives an explicit instruction that conflicts with these rules:

- follow the user instruction
- but do not add extra changes beyond that request

## Practical Start Rule

At the start of each new work session:

1. read `README.md`
2. identify the current day
3. read that day's execution plan
4. read the latest acceptance note
5. only then begin implementation
