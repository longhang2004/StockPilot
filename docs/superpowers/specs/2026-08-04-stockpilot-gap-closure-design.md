# StockPilot gap-closure and UI redesign

## Goal

Close the remaining plan gaps without weakening the existing tenant, ledger,
reservation, idempotency, or RBAC boundaries. The web workspace will be
reframed as a calm, data-dense operations console for a small wholesale team,
following the persisted UI UX Pro Max design system in
`design-system/stockpilot/MASTER.md`.

## Design system

- Style: accessible Swiss operations console with exaggerated-minimalist
  hierarchy, dense but scannable data surfaces, and one clear primary action per
  view.
- Palette: slate primary (`#334155`), stock green accent (`#059669`), warm
  neutral background (`#F8FAFC`), charcoal foreground (`#0F172A`), amber for
  attention, and red for destructive/error states. Semantic tokens are the only
  colors used by components.
- Type: Inter for interface copy and JetBrains Mono for SKU, order IDs,
  quantities, and money. Use tabular numerals and a stable font-loading path.
- Interaction: Phosphor outline icons, minimum 44px touch targets, visible
  focus rings, 150–300ms transitions, reduced-motion fallback, no emoji icons,
  and no color-only state communication.
- Responsive: mobile-first at 375px, then 768px, 1024px, and 1440px. Desktop
  uses a persistent sidebar; mobile uses a five-item bottom navigation and
  bottom sheets/action drawers.

## Backend completion

### Inventory reconciliation

Add a tenant-scoped reconciliation service that derives low-stock alert state
from every inventory balance. It runs after receipt, adjustment, confirmation,
cancellation, and fulfillment transactions, and also runs as a scheduled
pg-boss job so old or manually-seeded balances self-heal. The transition logic
will open an alert when a balance is already at/below its reorder point and
will preserve the single-open-alert constraint.

### Owner visibility

Add read-only organization settings and team endpoints. They expose the active
organization, warehouse, currency, and canonical demo memberships without
adding signup, invitations, or role editing.

### Observability and safety

Use a structured JSON request logger with a fixed redaction list for cookies,
authorization, CSRF, webhook signatures, and database URLs. Add optional Sentry
exception capture controlled by `SENTRY_DSN`; no Sentry dependency or network
call is made when the value is absent. Add CSP/security headers to the web
runtime and keep readiness explicit for database and queue health.

## Web architecture

Introduce a small typed client layer using the shared contracts and TanStack
Query/Table. React Hook Form + Zod will drive all mutation forms. Reusable
components will include:

- `AppShell`, `PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`,
  `ErrorState`, `Skeleton`, `ToastRegion`;
- `SearchFilterBar`, `ResponsiveDataTable`, `MobileRecordCard`,
  `Pagination`;
- accessible `Drawer`, `Dialog`, `ConfirmDialog`, `FormField`, and
  `UnsavedChangesGuard`.

All drawers manage focus, Escape/cancel, body scroll, and dirty-form dismissal.
Mutation buttons disable while pending and announce success/error through an
`aria-live` region.

## User workflows

1. Overview: exception queue, open order value, recent orders, recent stock
   movements, and an accessible 14-day inbound/outbound table/visual summary.
2. Orders: search/status filters, order detail drawer, Draft editing,
   Manager confirmation, Staff fulfillment, cancellation confirmation, and
   transition timeline.
3. Inventory: balance/search filters, adjustment drawer, alert filtering, and
   receipt flow with supplier/product selectors.
4. Catalog and partners: create/edit/inactivate forms, validation, search,
   pagination, and read-only behavior for Staff.
5. Imports: file upload → preview → commit valid rows → results/errors CSV,
   with a step indicator and recoverable errors.
6. Integrations: delivery detail, failure explanation, retry action, and
   retry feedback.
7. Owner settings: organization/warehouse summary, team view, and demo reset.

## Quality gates

- Unit/integration tests cover reconciliation transitions, owner visibility,
  observability redaction, and mutation permissions.
- Playwright covers Manager receipt/confirm, Staff fulfill, duplicate webhook,
  Owner reset, and the mobile receipt-to-fulfillment path.
- `@axe-core/playwright` runs smoke checks on public, login, overview, orders,
  and inventory routes.
- Vitest coverage enforces at least 80% branch coverage for core domain
  modules; CI runs format, lint, typecheck, coverage, migrations, build, and
  E2E smoke.
- Deployment artifacts document Vercel web, Railway API/worker, Neon Postgres,
  queue configuration, migrations, smoke checks, and secret requirements.

## Non-goals preserved

Signup/invitations, purchase orders, partial receiving/fulfillment, payments,
tax, debt, returns, variants, barcode/lot/serial, valuation,
multi-warehouse, Redis, real marketplace integrations, and production SLA stay
out of scope.
