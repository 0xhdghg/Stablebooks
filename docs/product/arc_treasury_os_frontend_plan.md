# Stablebooks Frontend Implementation Plan

## Document status

- Version: `v0.2`
- Date: `2026-04-19`
- Product: `Stablebooks`
- Scope: `MVP frontend implementation plan`
- Companion docs:
  - [arc_treasury_os_blueprint.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_blueprint.md)
  - [arc_treasury_os_prd.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_prd.md)
  - [arc_treasury_os_ia_wireframes.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_ia_wireframes.md)
  - [arc_treasury_os_milestone_4_foundation.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_foundation.md)
  - [arc_treasury_os_milestone_4_execution_backlog.md](/G:/bugbounty/Stablebooks/docs/product/arc_treasury_os_milestone_4_execution_backlog.md)

## Goal

This document converts the product and wireframe specs into a concrete frontend delivery plan for a solo builder.

It covers:

- recommended frontend stack,
- project structure,
- route structure,
- component tree,
- state and data strategy,
- implementation order,
- engineering backlog.

The plan is optimized for:

- fast MVP delivery,
- clean separation between admin app and hosted payer flow,
- low-complexity maintenance,
- future extension without major rewrites.

## Recommended frontend stack

### Core

- `Next.js` with App Router
- `TypeScript`
- `React Server Components` by default
- `Tailwind CSS`
- `shadcn/ui` style component patterns or an equivalent local component system
- `Viem` for wallet interactions
- `TanStack Query` for client-side fetching and mutation state
- `React Hook Form` plus `Zod` for forms
- `Lucide` or similar icon set

### Why this stack

- Next.js App Router gives you a natural split between admin app and hosted invoice pages.
- Server components help keep the dashboard and tables fast and simple.
- TanStack Query gives you a sane client data model for mutations, polling, and status refresh.
- React Hook Form plus Zod is the fastest reliable path for finance-oriented forms.

## Frontend architecture principles

### 1. Server-first by default

Use server components for:

- page shells,
- initial data loading,
- static and semi-static dashboard views,
- layout-level auth gating.

Use client components only for:

- forms,
- filters,
- dialogs,
- wallet interactions,
- polling-based payment status,
- tables that require richer interactivity.

### 2. Route-local ownership

Each route owns:

- its page,
- its loading and error states,
- its local data fetching entrypoint,
- route-specific components.

Shared UI lives in `components`.

### 3. Domain-driven folders

Organize by product domains instead of purely by component type.

Primary frontend domains:

- auth
- onboarding
- dashboard
- invoices
- customers
- treasury
- reconciliation
- exports
- settings
- hosted-payments

### 4. Keep public and authenticated surfaces separate

The hosted invoice flow should not depend on admin layout state or authenticated app code.

### 5. Build for optimistic clarity, not aggressive optimism

This is finance software.

Avoid overly optimistic UI updates for:

- payment completion,
- status transitions,
- invoice finality.

Prefer explicit pending states and server-confirmed transitions.

## Repository and folder structure

Recommended root frontend structure:

```text
stablebooks/
  app/
  components/
  features/
  lib/
  hooks/
  providers/
  styles/
  types/
  public/
  tests/
```

Expanded structure:

```text
stablebooks/
  app/
    (auth)/
      signin/
        page.tsx
      signup/
        page.tsx
      layout.tsx
    (onboarding)/
      onboarding/
        org/
          page.tsx
        wallets/
          page.tsx
      layout.tsx
    (app)/
      dashboard/
        page.tsx
        loading.tsx
        error.tsx
      invoices/
        page.tsx
        loading.tsx
        new/
          page.tsx
        [invoiceId]/
          page.tsx
          loading.tsx
          error.tsx
      customers/
        page.tsx
        [customerId]/
          page.tsx
      treasury/
        page.tsx
        rules/
          [ruleId]/
            page.tsx
      reconciliation/
        unmatched/
          page.tsx
      payments/
        [paymentId]/
          page.tsx
      webhooks/
        page.tsx
        [deliveryId]/
          page.tsx
      exports/
        page.tsx
      settings/
        organization/
          page.tsx
        wallets/
          page.tsx
        team/
          page.tsx
      layout.tsx
    pay/
      [publicInvoiceToken]/
        page.tsx
        processing/
          page.tsx
        success/
          page.tsx
        issue/
          page.tsx
      layout.tsx
    api/
      health/
        route.ts
    globals.css
    layout.tsx
    not-found.tsx
  components/
    ui/
    layout/
    data-display/
    feedback/
    forms/
    charts/
  features/
    auth/
    onboarding/
    dashboard/
    invoices/
    customers/
    treasury/
    reconciliation/
    exports/
    settings/
    hosted-payments/
  lib/
    api/
    auth/
    config/
    formatters/
    validators/
    utils/
    analytics/
  hooks/
    use-current-org.ts
    use-debounced-value.ts
    use-mobile.ts
    use-polling.ts
  providers/
    app-providers.tsx
    query-provider.tsx
    theme-provider.tsx
    wallet-provider.tsx
  styles/
    tokens.css
  types/
    api.ts
    domain.ts
    ui.ts
  tests/
    e2e/
    integration/
    unit/
```

## Route structure

## Route groups

Use route groups to separate shells:

- `(auth)` for sign in and sign up
- `(onboarding)` for setup flow
- `(app)` for authenticated admin application
- `pay` for public hosted invoice flow

This keeps layouts clean and avoids conditional layout hacks.

## Admin route structure

```text
/(app)/dashboard
/(app)/invoices
/(app)/invoices/new
/(app)/invoices/[invoiceId]
/(app)/customers
/(app)/customers/[customerId]
/(app)/treasury
/(app)/treasury/rules/[ruleId]
/(app)/reconciliation/unmatched
/(app)/payments/[paymentId]
/(app)/webhooks
/(app)/exports
/(app)/settings/organization
/(app)/settings/wallets
/(app)/settings/team
```

## Public route structure

```text
/pay/[publicInvoiceToken]
/pay/[publicInvoiceToken]/processing
/pay/[publicInvoiceToken]/success
/pay/[publicInvoiceToken]/issue
```

## Layout strategy

### Root layout

Responsibilities:

- global HTML shell
- global styles
- providers
- metadata

### Auth layout

Responsibilities:

- centered auth shell
- minimal branding
- no authenticated chrome

### Onboarding layout

Responsibilities:

- progress header
- lightweight shell
- auth-protected but simplified

### App layout

Responsibilities:

- auth gate
- sidebar navigation
- top bar
- content container
- mobile navigation

### Public pay layout

Responsibilities:

- hosted payment branding
- simple centered public experience
- no auth dependencies

## Feature folder structure

Use `features/` to colocate domain-specific frontend logic:

```text
features/
  dashboard/
    components/
    queries.ts
    transformers.ts
    types.ts
  invoices/
    components/
    forms/
    queries.ts
    mutations.ts
    transformers.ts
    validators.ts
    types.ts
  customers/
    components/
    queries.ts
    mutations.ts
  treasury/
    components/
    queries.ts
    mutations.ts
    validators.ts
  reconciliation/
    components/
    queries.ts
    mutations.ts
  exports/
    components/
    mutations.ts
    validators.ts
  hosted-payments/
    components/
    queries.ts
    mutations.ts
    polling.ts
```

Why this structure:

- pages stay thin,
- fetching logic remains domain-local,
- future extraction into shared packages stays possible,
- easier for a solo builder to reason about ownership.

## Component architecture

## Component layers

Use four levels of components:

1. `ui` primitives
2. `shared composites`
3. `feature components`
4. `route compositions`

### 1. UI primitives

Location:

- `components/ui`

Examples:

- Button
- Input
- Select
- Table
- Badge
- Card
- Dialog
- Drawer
- Tabs
- Sheet
- Tooltip
- Skeleton
- Toast

These components should stay presentation-focused.

### 2. Shared composites

Location:

- `components/layout`
- `components/data-display`
- `components/feedback`
- `components/forms`

Examples:

- AppSidebar
- AppTopbar
- PageHeader
- EmptyState
- StatusBadge
- MetricCard
- DataTable
- FilterBar
- Timeline
- SummaryCard
- LoadingState
- ErrorState

### 3. Feature components

Location:

- `features/<domain>/components`

Examples:

- InvoiceTable
- CreateInvoiceForm
- InvoiceSummaryCard
- PaymentTimeline
- TreasuryBalancesTable
- UnmatchedPaymentsTable
- HostedPaymentPanel

These components can depend on domain types and domain queries.

### 4. Route compositions

Location:

- `app/**/page.tsx`

Responsibilities:

- fetch data,
- compose feature sections,
- define page-level states,
- bind route params.

## Global component tree

High-level admin app tree:

```text
RootLayout
  AppProviders
    AppLayout
      AppSidebar
      AppTopbar
      RoutePage
        PageHeader
        PageContent
```

High-level hosted pay tree:

```text
RootLayout
  AppProviders
    PublicPayLayout
      HostedPaymentPage
        InvoiceSummaryCard
        PaymentMethodPanel
        PaymentStatusPanel
```

## Screen-by-screen component tree

## 1. Dashboard

```text
DashboardPage
  PageHeader
  DashboardMetricsRow
    MetricCard x4
  DashboardContentGrid
    RecentPaymentsCard
      RecentPaymentsList
    InvoiceAgingCard
      AgingBreakdown
    ReconciliationAlertsCard
      AlertList
    TreasurySnapshotCard
      TreasurySnapshotList
    QuickActionsCard
      ActionButtonList
```

Recommended files:

```text
features/dashboard/components/
  dashboard-metrics-row.tsx
  recent-payments-card.tsx
  invoice-aging-card.tsx
  reconciliation-alerts-card.tsx
  treasury-snapshot-card.tsx
  quick-actions-card.tsx
```

## 2. Invoice list

```text
InvoiceListPage
  PageHeader
  InvoiceFiltersBar
  InvoiceTableCard
    InvoiceTable
      StatusBadge
      RowActionsMenu
  PaginationControls later
```

Recommended files:

```text
features/invoices/components/
  invoice-filters-bar.tsx
  invoice-table.tsx
  invoice-row-actions.tsx
```

## 3. Create invoice

```text
CreateInvoicePage
  PageHeader
  CreateInvoiceLayout
    CreateInvoiceForm
      CustomerSelectField
      AmountField
      CurrencyField
      DueDateField
      TokenSelectorField
      MemoField
      InternalReferenceField
      FormActions
    InvoicePreviewCard
      PreviewSummary
      SettlementPreview
```

Recommended files:

```text
features/invoices/forms/
  create-invoice-form.tsx
  customer-select-field.tsx
  token-selector-field.tsx
features/invoices/components/
  invoice-preview-card.tsx
```

## 4. Invoice detail

```text
InvoiceDetailPage
  PageHeader
  InvoiceDetailHeader
  InvoiceDetailGrid
    InvoiceSummaryCard
    PaymentStatusCard
    ChainObservationCard
    PaymentTimelineCard
      PaymentTimeline
    PaymentDetailsCard
    WebhookDeliverySummaryCard
    ReconciliationResultCard
    CustomerSummaryCard
    ActivityLogCard
```

Recommended files:

```text
features/invoices/components/
  invoice-detail-header.tsx
  invoice-summary-card.tsx
  payment-status-card.tsx
  chain-observation-card.tsx
  payment-details-card.tsx
  webhook-delivery-summary-card.tsx
  activity-log-card.tsx
features/reconciliation/components/
  reconciliation-result-card.tsx
components/data-display/
  timeline.tsx
```

## 5. Customer list

```text
CustomerListPage
  PageHeader
  CustomerSearchBar
  CustomerTableCard
    CustomerTable
```

## 6. Customer detail

```text
CustomerDetailPage
  PageHeader
  CustomerSummaryCard
  CustomerInvoicesCard
    CustomerInvoiceTable
  CustomerNotesCard later
```

## 7. Treasury overview

```text
TreasuryPage
  PageHeader
  TreasuryMetricsRow
    MetricCard x4
  TreasuryContentGrid
    WalletBalancesCard
      WalletBalancesTable
    RecentSettlementsCard
      RecentSettlementsList
    RoutingRulesSummaryCard
      RuleSummaryList
    TreasuryAlertsCard
      AlertList
```

Recommended files:

```text
features/treasury/components/
  treasury-metrics-row.tsx
  wallet-balances-table.tsx
  recent-settlements-card.tsx
  routing-rules-summary-card.tsx
  treasury-alerts-card.tsx
```

## 8. Treasury rule detail

```text
TreasuryRuleDetailPage
  PageHeader
  TreasuryRuleEditorLayout
    TreasuryRuleForm
      RuleTypeSelect
      RuleConfigFields
      RuleActions
    RulePreviewCard
    RuleStatusCard
```

## 9. Unmatched payments queue

```text
UnmatchedPaymentsPage
  PageHeader
  UnmatchedSummaryBanner
  UnmatchedFiltersBar
  UnmatchedPaymentsTable
    RowActionsMenu
  PaymentDetailDrawer or RouteLink
```

Recommended files:

```text
features/reconciliation/components/
  unmatched-summary-banner.tsx
  unmatched-filters-bar.tsx
  unmatched-payments-table.tsx
```

## 10. Payment detail

```text
PaymentDetailPage
  PageHeader
  PaymentSummaryCard
  PaymentChainMovementCard
  PaymentSettlementDecisionCard
  PaymentInvoiceLinkageCard
  PaymentWebhookDeliveriesCard
  PaymentEventLogCard
  PaymentActionsCard
```

## 11. Export center

```text
ExportsPage
  PageHeader
  ExportFormCard
    ExportForm
  ExportPreviewCard
  ExportHistoryCard later
```

## 12. Organization settings

```text
OrganizationSettingsPage
  PageHeader
  OrganizationProfileForm
  SaveBar
```

## 13. Wallet settings

```text
WalletSettingsPage
  PageHeader
  WalletsTableCard
    WalletsTable
  AddWalletDialog
  EditWalletDrawer
```

## 14. Webhook operations

```text
WebhookOperationsPage
  PageHeader
  WebhookConfigForm
  WebhookTestCard
  WebhookDeliveryHealthCard
  WebhookDeliveriesTable
  DeadLetterQueueCard
```

Recommended files:

```text
features/webhooks/components/
  webhook-config-form.tsx
  webhook-test-card.tsx
  webhook-delivery-health-card.tsx
  webhook-deliveries-table.tsx
  dead-letter-queue-card.tsx
```

## 15. Team settings

```text
TeamSettingsPage
  PageHeader
  TeamMembersTable
  InviteMemberDialog
```

## 16. Hosted invoice page

```text
HostedInvoicePage
  PublicHeader
  HostedInvoiceShell
    InvoiceSummaryCard
    HostedPaymentPanel
      PaymentMethodTabs or SinglePanel
      WalletConnectButton
      ManualPaymentDetails
      PaymentReferenceBox
    PaymentStatusPanel
    SupportInfoCard
```

Recommended files:

```text
features/hosted-payments/components/
  hosted-invoice-shell.tsx
  hosted-payment-panel.tsx
  payment-status-panel.tsx
  payment-reference-box.tsx
  support-info-card.tsx
```

## 17. Hosted processing page

```text
HostedProcessingPage
  PublicHeader
  ProcessingCard
    ProcessingStepper
    TransactionSummary
    RefreshStatusAction
```

## 18. Hosted success page

```text
HostedSuccessPage
  PublicHeader
  PaymentReceiptCard
```

## 19. Hosted issue page

```text
HostedIssuePage
  PublicHeader
  IssueStateCard
    RetryAction
    ContactSupportAction
```

## Milestone 4 operator settlement surfaces

Milestone 4 should expose settlement truth directly in the existing operator
pages instead of hiding it behind debug workflows.

### Invoice detail requirements

- show `txHash`, `blockNumber`, `from`, `to`, `token`, `amount`, `decimals`,
  `chainId`, and `confirmedAt` when they exist
- show payment status and match result separately so operators can distinguish
  `processing`, `finalized`, `failed`, `unmatched`, and `ambiguous`
- show the latest webhook delivery state directly on invoice detail

### Payment detail requirements

- make payment detail the deepest audit view for settlement state
- show the canonical onchain field set in one settlement summary surface
- show the settlement decision reason that moved the payment to
  `processing`, `finalized`, or `failed`
- show linked webhook deliveries and replay health

### Webhook operations requirements

- keep endpoint configuration and test actions at the top of `/webhooks`
- add a deliveries table with status, attempts, next retry time, and last
  response code
- add a dead-letter summary so operators can find failed deliveries quickly

## Data and state strategy

## Data-fetching rules

### Use server-side data loading for

- dashboard initial metrics,
- invoice list initial render,
- invoice detail initial render,
- customer list and detail,
- treasury overview,
- settings pages,
- public invoice bootstrap data.

### Use TanStack Query on the client for

- filter-driven refetching,
- create/update mutations,
- optimistic local form UX,
- payment status polling,
- webhook test actions,
- manual reconciliation actions.

## Query key strategy

Recommended query key naming:

```text
['me']
['organization']
['wallets']
['dashboard', { period }]
['invoices', filters]
['invoice', invoiceId]
['customers', filters]
['customer', customerId]
['treasury-overview']
['treasury-rule', ruleId]
['unmatched-payments', filters]
['payment', paymentId]
['exports', filters]
['public-invoice', publicInvoiceToken]
['public-invoice-status', publicInvoiceToken]
```

## Mutation ownership

Keep mutations close to feature domains:

- `features/invoices/mutations.ts`
- `features/customers/mutations.ts`
- `features/treasury/mutations.ts`
- `features/reconciliation/mutations.ts`
- `features/exports/mutations.ts`
- `features/settings/mutations.ts`
- `features/hosted-payments/mutations.ts`

## Form strategy

Use one validator schema per major form:

- sign in schema
- sign up schema
- organization setup schema
- wallet form schema
- customer form schema
- create invoice schema
- treasury rule schema
- export form schema
- webhook form schema

Folder convention:

```text
features/<domain>/validators.ts
```

## API client structure

Recommended structure:

```text
lib/api/
  client.ts
  server.ts
  errors.ts
  endpoints/
    auth.ts
    dashboard.ts
    invoices.ts
    customers.ts
    treasury.ts
    reconciliation.ts
    exports.ts
    settings.ts
    public.ts
```

Responsibilities:

- `client.ts`: browser-safe fetch wrapper
- `server.ts`: server-component fetch wrapper with cookies/headers
- `errors.ts`: normalized API error mapper
- `endpoints/*.ts`: typed endpoint functions

## Type strategy

Recommended split:

- `types/domain.ts` for frontend domain entities
- `types/api.ts` for request/response payloads
- feature-local types for transformations

Examples:

```text
types/domain.ts
  Organization
  Wallet
  Customer
  Invoice
  Payment
  TreasuryRule

types/api.ts
  GetInvoicesResponse
  CreateInvoicePayload
  TreasuryOverviewResponse
```

## Auth and access model

For MVP, frontend auth assumptions:

- email/password auth or magic link behind a backend auth service,
- session cookie for authenticated app routes,
- middleware or layout-level redirect for protected routes.

Recommended locations:

```text
lib/auth/
  session.ts
  guards.ts
middleware.ts
```

Responsibilities:

- gate `(app)` and `(onboarding)` routes,
- redirect unauthenticated users to `/signin`,
- redirect incomplete onboarding users to `/onboarding/org` or `/onboarding/wallets`.

## Styling strategy

## Design system direction

Keep the UI calm, structured, and finance-oriented.

Recommended styling approach:

- define semantic tokens in `styles/tokens.css`
- build a small internal design system
- use consistent spacing, surface, and status tokens

Suggested token groups:

- colors
- spacing
- radii
- shadows
- typography
- status colors

Example structure:

```text
styles/
  tokens.css
app/
  globals.css
```

## Responsive rules

### Desktop first

Optimize primary finance workflows for desktop:

- invoices,
- treasury,
- exports,
- reconciliation.

### Mobile support

Support:

- quick dashboard review,
- invoice creation if needed,
- hosted payment flow,
- basic settings.

Defer:

- deeply interactive table workflows,
- complex treasury rule editing polish.

## Recommended implementation sequence

## Phase 1: Project foundation

Goal:

Create the shell, infra, and route scaffolding.

Tasks:

1. Initialize Next.js app with TypeScript and Tailwind.
2. Set up App Router layouts and route groups.
3. Add core providers: Query, auth, wallet placeholder, toast.
4. Build UI primitives and base layout components.
5. Set up API client and type foundations.
6. Add auth guard and onboarding redirect behavior.

Deliverable:

- navigable app shell with placeholder routes.

## Phase 2: Auth and onboarding

Goal:

Get users into a ready state for invoicing.

Tasks:

1. Build sign in page.
2. Build sign up page.
3. Build organization setup page.
4. Build wallet setup page.
5. Wire validation and submission flows.
6. Add onboarding completion logic and redirect.

Deliverable:

- functional onboarding flow from account creation to dashboard.

## Phase 3: Invoice core loop

Goal:

Ship the highest-value admin flow.

Tasks:

1. Build dashboard initial metrics layout.
2. Build invoice list with filters.
3. Build create invoice page and form.
4. Build invoice detail page.
5. Add customer selection and basic inline customer creation.
6. Wire all invoice APIs and mutations.

Deliverable:

- an operator can create and review invoices in the admin app.

## Phase 4: Hosted payment flow

Goal:

Ship the public payment experience.

Tasks:

1. Build hosted invoice page.
2. Build wallet connect and payment action shell.
3. Build processing page with polling.
4. Build success page.
5. Build issue page.
6. Wire public invoice bootstrap and status endpoints.

Deliverable:

- a payer can open an invoice link and follow payment status.

## Phase 5: Treasury and reconciliation

Goal:

Expose operational post-payment workflows.

Tasks:

1. Build treasury overview page.
2. Build unmatched payments queue.
3. Build payment detail page.
4. Build basic treasury rule detail page.

Deliverable:

- finance users can inspect balances and exceptions.

## Phase 6: Exports and settings

Goal:

Complete the MVP operations surface.

Tasks:

1. Build export center.
2. Build organization settings.
3. Build wallet settings.
4. Build webhook settings.
5. Build team settings lightweight version.

Deliverable:

- MVP admin surface is complete enough for pilot use.

## Backlog by epic

## Epic 0: Foundation and infrastructure

### Story 0.1

Set up the frontend repo and baseline toolchain.

Acceptance criteria:

- Next.js App Router project boots locally.
- Tailwind is configured.
- TypeScript strict mode is enabled.
- Base linting and formatting are configured.

### Story 0.2

Implement app providers and base layouts.

Acceptance criteria:

- Root layout mounts query provider and global toaster.
- App layout renders sidebar, top bar, and content area.
- Auth and public layouts render without admin chrome.

### Story 0.3

Create shared UI primitives.

Acceptance criteria:

- buttons, inputs, cards, tables, badges, dialogs, drawers, skeletons exist,
- primitives are reusable and typed.

### Story 0.4

Add typed API client helpers.

Acceptance criteria:

- server and client fetch helpers exist,
- API errors are normalized,
- endpoint helpers are organized by domain.

## Epic 1: Auth and onboarding

### Story 1.1

Build sign in screen.

Acceptance criteria:

- form validates email and password,
- submit triggers auth mutation,
- error message appears on failure.

### Story 1.2

Build sign up screen.

Acceptance criteria:

- account creation form validates input,
- success redirects to onboarding.

### Story 1.3

Build organization setup screen.

Acceptance criteria:

- org name, billing country, and base currency can be submitted,
- validation errors render inline.

### Story 1.4

Build wallet setup screen.

Acceptance criteria:

- Arc wallet can be added,
- duplicate and invalid wallet errors are shown,
- completion redirects to dashboard.

### Story 1.5

Implement route guards and onboarding redirects.

Acceptance criteria:

- unauthenticated users cannot open app routes,
- incomplete onboarding redirects correctly.

## Epic 2: Dashboard

### Story 2.1

Build dashboard page shell.

Acceptance criteria:

- KPI cards render,
- quick actions render,
- empty state is supported.

### Story 2.2

Build recent payments and alerts sections.

Acceptance criteria:

- recent payments list renders from data,
- reconciliation alerts show actionable counts.

## Epic 3: Customers

### Story 3.1

Build customer list page.

Acceptance criteria:

- customer table or cards render,
- search works,
- empty state exists.

### Story 3.2

Build customer detail page.

Acceptance criteria:

- customer summary renders,
- linked invoices are shown.

### Story 3.3

Support inline customer creation for invoice flow.

Acceptance criteria:

- user can create a customer without leaving create invoice flow.

## Epic 4: Invoices

### Story 4.1

Build invoice list page.

Acceptance criteria:

- invoices render in table,
- filters can be applied,
- row actions exist.

### Story 4.2

Build create invoice page.

Acceptance criteria:

- invoice form validates,
- draft and publish actions exist,
- preview card updates as form changes.

### Story 4.3

Build invoice detail page.

Acceptance criteria:

- invoice summary renders,
- payment status and timeline render,
- copy link action works.

### Story 4.4

Implement invoice mutations and query invalidation.

Acceptance criteria:

- publish refreshes invoice list and detail,
- error and success toasts show correctly.

## Epic 5: Hosted payments

### Story 5.1

Build public invoice page.

Acceptance criteria:

- public invoice data loads without auth,
- amount, accepted token, and reference display clearly.

### Story 5.2

Build payment status panel and processing states.

Acceptance criteria:

- status changes from awaiting payment to processing to paid,
- polling stops after final state.

### Story 5.3

Build success and issue pages.

Acceptance criteria:

- success page shows receipt summary,
- issue page supports recovery messaging.

### Story 5.4

Integrate wallet connect shell.

Acceptance criteria:

- wallet connect CTA exists,
- payment initiation shell is wired for future backend/onchain integration.

## Epic 6: Treasury

### Story 6.1

Build treasury overview page.

Acceptance criteria:

- wallet balances render,
- recent settlements render,
- rules summary renders.

### Story 6.2

Build treasury rule detail page.

Acceptance criteria:

- simple rule editing works,
- validation prevents invalid percentage splits.

## Epic 7: Reconciliation

### Story 7.1

Build unmatched payments queue.

Acceptance criteria:

- unmatched payments render,
- filters work,
- empty healthy state exists.

### Story 7.2

Build payment detail page.

Acceptance criteria:

- source tx and Arc tx display,
- invoice linkage is visible,
- manual action entry point exists.

## Epic 8: Exports

### Story 8.1

Build export center.

Acceptance criteria:

- user can choose export type and date range,
- export mutation runs,
- success feedback and download path are shown.

## Epic 9: Settings

### Story 9.1

Build organization settings page.

### Story 9.2

Build wallet settings page.

### Story 9.3

Build webhook settings page.

### Story 9.4

Build team settings page.

Acceptance criteria for Epic 9:

- each page renders current configuration,
- update actions are available for MVP-relevant settings.

## Cross-cutting backlog

## UX and accessibility

### Story A.1

Implement keyboard-accessible dialogs, forms, and tables.

### Story A.2

Ensure status color is not the only state indicator.

### Story A.3

Add empty, loading, and error states for every route.

## Analytics

### Story B.1

Set up analytics event wrapper.

### Story B.2

Instrument onboarding, invoice creation, hosted payment, and export events.

## Testing

### Story C.1

Set up unit tests for validators and utilities.

### Story C.2

Set up integration tests for forms and route behaviors.

### Story C.3

Add e2e happy path for:

- sign up,
- onboarding,
- create invoice,
- hosted invoice page open.

## Performance

### Story D.1

Add route-level loading states and skeletons.

### Story D.2

Audit client component boundaries to keep bundles lean.

## Suggested initial file creation order

If implementing from zero, create files in this order:

1. `app/layout.tsx`
2. `providers/app-providers.tsx`
3. `app/(app)/layout.tsx`
4. `components/layout/app-sidebar.tsx`
5. `components/layout/app-topbar.tsx`
6. `components/layout/page-header.tsx`
7. `components/ui/*` core primitives
8. `lib/api/client.ts`
9. `lib/api/server.ts`
10. `app/(auth)/signin/page.tsx`
11. `app/(auth)/signup/page.tsx`
12. `app/(onboarding)/onboarding/org/page.tsx`
13. `app/(onboarding)/onboarding/wallets/page.tsx`
14. `app/(app)/dashboard/page.tsx`
15. `app/(app)/invoices/page.tsx`
16. `app/(app)/invoices/new/page.tsx`
17. `app/(app)/invoices/[invoiceId]/page.tsx`
18. `app/pay/[publicInvoiceToken]/page.tsx`
19. `app/pay/[publicInvoiceToken]/processing/page.tsx`
20. `app/pay/[publicInvoiceToken]/success/page.tsx`

## Suggested milestone plan

## Milestone 1

Ship shell and onboarding.

Definition of done:

- users can sign up,
- create organization,
- add settlement wallet,
- land in dashboard shell.

## Milestone 2

Ship invoice admin loop.

Definition of done:

- users can create, publish, list, and inspect invoices.

## Milestone 3

Ship hosted payment loop.

Definition of done:

- public invoice page works,
- processing and success states work,
- status polling works.

## Milestone 4

Ship operations layer.

Definition of done:

- treasury,
- unmatched queue,
- exports,
- settings all work at MVP level.

## Solo-builder recommendations

To keep execution realistic:

1. Build desktop first for the admin app.
2. Fully polish only the hosted payment flow on mobile in MVP.
3. Use mocked API payloads for UI scaffolding before backend endpoints are complete.
4. Do not overbuild a design system before the invoice and hosted payment loop exist.
5. Keep route pages thin and feature folders disciplined from day one.

## Final implementation summary

The frontend should be built around one trusted financial loop:

1. onboard organization,
2. create invoice,
3. share hosted payment link,
4. track payment to Arc finality,
5. review invoice detail,
6. inspect treasury and exports.

If the codebase structure reinforces that loop, the MVP will stay coherent and fast to evolve.
