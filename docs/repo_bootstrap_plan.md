# Stablebooks Repo Bootstrap Plan

## Goal

Turn the project specifications into a working monorepo with a clean implementation path for:

- `apps/web`
- `apps/api`
- shared repo tooling
- docs that stay close to the codebase

## Repository decisions

### Monorepo shape

Use a small application-first monorepo:

- `apps/web` for the Next.js product surface
- `apps/api` for the NestJS backend and future worker logic
- `packages/` reserved for shared packages when duplication appears

### Workspace tooling

Use:

- `pnpm` workspaces
- `turbo` for task orchestration
- root `tsconfig.base.json` for shared TypeScript defaults

### Why this shape

- keeps frontend and backend versioned together,
- preserves product docs close to implementation,
- stays simple enough for a solo builder,
- allows extraction of shared packages later without early complexity.

## Current scaffold

The repository now includes:

- root workspace files
- minimal `web` app shell
- minimal `api` app shell
- organized docs under [docs/product](/G:/bugbounty/Stablebooks/docs/product)

## Bootstrap phases

## Phase 1: Workspace install

1. Run `corepack pnpm install` from the repo root.
2. Confirm the workspace recognizes `apps/web` and `apps/api`.
3. Run `corepack pnpm dev:web` and `corepack pnpm dev:api` separately to verify shell startup.

Success criteria:

- Next.js app starts on port `3000`
- NestJS app starts on port `4000`
- health endpoint responds at `/api/v1/health/live`

## Phase 2: Core tooling

1. Add ESLint and Prettier or your preferred formatter setup.
2. Add Husky or lightweight pre-commit hooks later if useful.
3. Add testing libraries:
   - frontend unit/integration
   - backend unit/integration
   - e2e later

Success criteria:

- lint and typecheck scripts run from the root
- both apps compile with shared TypeScript settings

## Phase 3: Frontend shell build-out

1. Add route groups for:
   - auth
   - onboarding
   - app
   - pay
2. Add providers and app layout.
3. Build dashboard, invoices, and hosted payment route shells.

Reference:

- [frontend plan](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_frontend_plan.md)

## Phase 4: Backend module build-out

1. Expand NestJS into modular domains:
   - auth
   - organizations
   - wallets
   - customers
   - invoices
   - payments
2. Add Prisma models and initial migrations.
3. Add Redis and BullMQ for background jobs.

Reference:

- [backend/API plan](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_backend_api_plan.md)

## Phase 5: Shared integration contract

1. Align frontend query needs with API response shapes.
2. Lock the first stable status enums and ids.
3. Add mocked fixtures so frontend can continue while backend endpoints land incrementally.

Success criteria:

- frontend can work against mock or live endpoints without changing domain contracts

## Phase 6: First end-to-end loop

Ship this exact product loop first:

1. sign up
2. create organization
3. add Arc settlement wallet
4. create invoice
5. open hosted invoice page
6. simulate payment detection
7. mark invoice finalized

Success criteria:

- the loop works from UI to API with one canonical invoice state transition path

## Suggested short-term repo additions

Add next:

- `apps/web/components/ui`
- `apps/web/providers`
- `apps/web/hooks`
- `apps/api/src/modules`
- `apps/api/src/config`
- `apps/api/src/common`
- `apps/api/src/jobs`
- `packages/types` once shared API contracts appear

## Rules for future structure

1. Keep product docs in `docs/product`.
2. Keep implementation guides in `docs/`.
3. Do not create shared packages until duplication is real.
4. Keep `web` and `api` independently runnable.
5. Prefer domain folders over technical sprawl.

## Recommended next command-level moves

1. Install dependencies.
2. Verify both starter apps boot.
3. Expand `apps/web` according to the frontend plan.
4. Expand `apps/api` according to the backend plan.
5. Add the first shared status enums only when both sides need them.

## Final note

The repo is intentionally bootstrapped as a small, disciplined monorepo.

That is the right shape for Stablebooks right now:

- enough structure to move fast,
- enough separation to stay clean,
- and no premature platform engineering.
