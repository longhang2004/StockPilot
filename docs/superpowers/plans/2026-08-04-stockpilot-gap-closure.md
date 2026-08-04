# StockPilot Gap Closure and UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining implementation gap in the approved StockPilot specification while preserving tenant isolation, RBAC, append-only inventory integrity, reservation concurrency, and webhook/idempotency guarantees.

**Architecture:** Keep the existing modular monolith and Prisma transaction boundary. Add inventory reconciliation as a tenant-scoped application service shared by synchronous mutations and a pg-boss scheduler; add owner read models without introducing write access to canonical demo roles. Replace the shallow web tables with a typed same-origin client, reusable accessible workflow primitives, and route-specific drawers/cards built on the persisted UI UX Pro Max design system.

**Tech Stack:** Node 24, pnpm, NestJS 11, Prisma 7, PostgreSQL/RLS, pg-boss, Next.js 16/React 19.2, TypeScript, TanStack Query/Table, React Hook Form, Zod, Phosphor Icons, Vitest, Playwright, axe.

## Global Constraints

- All identifiers remain UUIDs; timestamps remain UTC; money remains decimal(12,2); quantities are positive integers.
- Tenant organization comes only from the authenticated session; every tenant query remains inside `TenantDatabase.withTenant` and PostgreSQL RLS.
- `on_hand >= reserved >= 0`; stock movements stay append-only; all stock/order transitions remain atomic and idempotent.
- Public API stays under `/v1`; RFC 9457 `ProblemDetails` remains the error contract.
- Staff remains read-only for master data and transition confirmation/cancellation; Manager owns operational mutations; Owner gets settings/team/reset visibility.
- No signup/invitations, purchase orders, partial receiving/fulfillment, payments, tax, debt, returns, variants, barcode/lot/serial, valuation, multi-warehouse, Redis, real marketplace integration, or SLA work.
- UI uses semantic token colors, Inter/JetBrains Mono typography, Phosphor outline icons, 44px minimum targets, visible focus, reduced-motion support, and mobile breakpoints 375/768/1024/1440px.
- Every behavior task follows RED → GREEN → REFACTOR and ends with a runnable test command.

---

### Task 1: Inventory reconciliation and alert lifecycle

**Files:**

- Create: `apps/api/src/inventory/inventory-reconciliation.service.ts`
- Create: `apps/api/src/inventory/inventory-reconciliation.service.spec.ts`
- Modify: `apps/api/src/inventory/inventory-projection.ts`
- Modify: `apps/api/src/inventory/inventory.service.ts`
- Modify: `apps/api/src/orders/orders.service.ts`
- Modify: `apps/api/src/inventory/inventory.module.ts`
- Modify: `apps/api/src/jobs/job-runner.service.ts`
- Modify: `apps/api/src/jobs/jobs.module.ts`
- Modify: `apps/api/src/config/environment.ts`

**Interfaces:**

- Produce `InventoryReconciliationService.reconcileOrganization(organizationId, actorId?)` returning `{ scanned: number; opened: number; resolved: number }` and `reconcileBalance(transaction, { organizationId, warehouseId, productId, reorderPoint, available })` for use inside existing transactions.
- Change `lowStockTransition(previousAvailable, nextAvailable, reorderPoint, hasOpenAlert = false)` so an already-low balance opens exactly one alert and a recovered balance resolves its open alert.
- Produce a pg-boss `inventory.reconcile` job scheduled from the existing worker with a safe no-queue result when `QUEUE_DATABASE_URL` is absent.

- [ ] **Step 1: Write failing unit tests** for an initial low balance opening an alert, repeated reconciliation not duplicating it, recovery resolving it, and a confirmation lowering available stock opening an alert.
- [ ] **Step 2: Run `pnpm --filter @stockpilot/api test:unit -- inventory-reconciliation.service.spec.ts inventory-projection.spec.ts` and verify the new assertions fail.**
- [ ] **Step 3: Implement the pure transition change and transactional reconciliation helper; call it after receipt, adjustment, confirmation, cancellation, and fulfillment.**
- [ ] **Step 4: Implement the organization scan in a tenant transaction and register a daily/short-interval pg-boss schedule plus retry/dead-letter logging.**
- [ ] **Step 5: Run the focused tests, then the inventory/order integration suites; verify all pass and no alert duplicate exists.**
- [ ] **Step 6: Refactor duplicated alert transition code into the reconciliation service without changing public responses.**
- [ ] **Step 7: Commit `feat: reconcile low stock alerts across inventory workflows`.**

### Task 2: Owner read models and observability/security hardening

**Files:**

- Create: `apps/api/src/organization/organization.controller.ts`
- Create: `apps/api/src/organization/organization.service.ts`
- Create: `apps/api/src/organization/organization.module.ts`
- Create: `apps/api/src/organization/organization.service.spec.ts`
- Create: `apps/api/src/observability/redaction.ts`
- Create: `apps/api/src/observability/request-logging.interceptor.ts`
- Create: `apps/api/src/observability/sentry-exception.filter.ts`
- Create: `apps/api/src/observability/observability.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/configure-application.ts`
- Modify: `apps/api/src/config/environment.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

- Add `GET /v1/organization/settings` and `GET /v1/team`, guarded by `organization:settings:read`/`team:read`, returning only the authenticated organization, its single warehouse/currency, and canonical active memberships.
- Export `redactRecord(value)` that masks `cookie`, `authorization`, `x-csrf-token`, `x-webhook-signature`, `database_url`, `migration_database_url`, and `queue_database_url` recursively.
- Emit one JSON request line containing trace ID, method, path, status, duration, actor ID, organization ID, and redacted error metadata; capture exceptions only when `SENTRY_DSN` is configured.

- [ ] **Step 1: Write failing controller/service tests** for Owner success, Manager/Staff denial, organization isolation, and recursive secret redaction.
- [ ] **Step 2: Run the focused API tests and verify failure.**
- [ ] **Step 3: Implement organization read models using `TenantDatabase.withTenant`, DTO serialization, and module wiring.**
- [ ] **Step 4: Implement redacted structured logging, optional Sentry filter, and request trace propagation while retaining RFC 9457 responses.**
- [ ] **Step 5: Add strict web/API CSP and security headers, then run health/auth/tenant integration tests.**
- [ ] **Step 6: Commit `feat: add owner visibility and redacted observability`.**

### Task 3: Typed web foundation and design tokens

**Files:**

- Create: `apps/web/lib/api-client.ts`
- Create: `apps/web/lib/query-provider.tsx`
- Create: `apps/web/lib/forms.ts`
- Create: `apps/web/components/ui/*.tsx` for primitives listed below
- Create: `apps/web/components/app/app-shell.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/package.json`
- Modify: `package.json`

**Interfaces:**

- `apiRequest<T>(path, options?)` uses same-origin `/api/v1`, cookies, CSRF bootstrap, RFC 9457 parsing, and typed `@stockpilot/contracts` payloads.
- Provide `AppShell`, `PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`, `ErrorState`, `Skeleton`, `ToastRegion`, `SearchFilterBar`, `ResponsiveDataTable`, `MobileRecordCard`, `Pagination`, `Drawer`, `Dialog`, `ConfirmDialog`, `FormField`, and `UnsavedChangesGuard` with keyboard/focus/body-scroll behavior.

- [ ] **Step 1: Write component tests** for drawer Escape/focus return, confirm cancellation, toast live announcements, responsive table/card rendering, and API problem parsing.
- [ ] **Step 2: Run web unit tests and verify the new tests fail.**
- [ ] **Step 3: Add TanStack Query/Table, React Hook Form/resolvers, Phosphor, and axe dev dependencies; create the typed client/query provider.**
- [ ] **Step 4: Implement primitives with semantic HTML, 44px targets, focus-visible styles, reduced motion, and dirty-form dismissal.**
- [ ] **Step 5: Apply the persisted palette/type/spacing tokens and responsive navigation to the existing shell; run web tests and production build.**
- [ ] **Step 6: Commit `feat: establish accessible operations UI foundation`.**

### Task 4: Complete workflow routes and drawers

**Files:**

- Create: `apps/web/components/workflows/overview-workspace.tsx`
- Create: `apps/web/components/workflows/orders-workspace.tsx`
- Create: `apps/web/components/workflows/inventory-workspace.tsx`
- Create: `apps/web/components/workflows/catalog-workspace.tsx`
- Create: `apps/web/components/workflows/partners-workspace.tsx`
- Create: `apps/web/components/workflows/imports-workspace.tsx`
- Create: `apps/web/components/workflows/integrations-workspace.tsx`
- Create: `apps/web/components/workflows/settings-workspace.tsx`
- Modify: `apps/web/app/app/[section]/page.tsx`
- Modify: `apps/web/components/app/workspace-content.tsx`

**Interfaces:**

- Each route consumes typed query/mutation hooks and exposes loading, empty, error, success, and permission states.
- Orders support search/status filters, draft create/edit, detail drawer with snapshots and transition timeline, confirm/fulfill/cancel actions with idempotency keys and confirm dialogs.
- Inventory supports balance/alert filters, adjustment drawer, and receipt drawer; catalog/partners support create/edit/inactivate with Staff read-only behavior.
- Imports expose Upload → Preview → Commit → Results including valid-row commit and error CSV download; integrations expose detail, failure explanation, retry, and feedback; settings exposes organization/warehouse/team/reset.

- [ ] **Step 1: Add route-level tests for action visibility and required form validation.**
- [ ] **Step 2: Run route tests and verify failure.**
- [ ] **Step 3: Implement overview/order/inventory workflows and mutation feedback.**
- [ ] **Step 4: Implement catalog, partner, import, integration, and owner settings workflows.**
- [ ] **Step 5: Add accessible 14-day inbound/outbound table/compact visualization and mobile bottom navigation/action sheets.**
- [ ] **Step 6: Run all web unit tests and desktop/mobile visual smoke checks; refactor shared query keys/forms.**
- [ ] **Step 7: Commit `feat: complete responsive operations workflows`.**

### Task 5: E2E, accessibility, coverage, and CI

**Files:**

- Create: `tests/e2e/manager-receipt-confirm.spec.ts`
- Create: `tests/e2e/staff-fulfill.spec.ts`
- Create: `tests/e2e/duplicate-webhook.spec.ts`
- Create: `tests/e2e/owner-reset.spec.ts`
- Create: `tests/e2e/mobile-receipt-to-fulfillment.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/api/package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Playwright starts API and web against an isolated test database, seeds demo users, and tests desktop plus 390px mobile.
- axe smoke covers public, login, overview, orders, and inventory routes.
- Core domain coverage thresholds enforce 80% branch coverage without weakening existing test commands.

- [ ] **Step 1: Add failing Playwright specs and axe helper, then run one spec to verify the environment/test fails before implementation wiring.**
- [ ] **Step 2: Configure isolated database reset/seed and API+web webServers; make the five workflow specs pass.**
- [ ] **Step 3: Configure Vitest branch thresholds for inventory, orders, idempotency, and RBAC modules; run coverage and add only behavior-focused tests needed to reach 80%.**
- [ ] **Step 4: Update CI to run format, lint, typecheck, migration-from-empty, unit/integration coverage, build, and E2E/axe smoke.**
- [ ] **Step 5: Commit `test: add workflow e2e accessibility and coverage gates`.**

### Task 6: Deployment, threat model, and portfolio handoff

**Files:**

- Create: `docs/deployment.md`
- Create: `docs/test-report.md`
- Create: `docs/walkthrough.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/threat-model.md`
- Modify: `.env.example`
- Modify: `apps/api/Dockerfile`
- Modify: `apps/web/Dockerfile`

**Interfaces:**

- Deployment docs explicitly cover Vercel web same-origin proxy, Railway API/worker, Neon Postgres/RLS migration ordering, queue URL, Sentry optionality, secrets, readiness, and smoke commands.
- Test report records commands and results; walkthrough is a 2–3 minute reviewer path from demo login through receipt/confirm/fulfill, duplicate webhook, and owner reset.

- [ ] **Step 1: Write deployment/test/walkthrough documentation from the verified commands and environment names.**
- [ ] **Step 2: Add runtime CSP/proxy/health configuration and container checks, then run Docker build/config validation.**
- [ ] **Step 3: Update architecture/threat model for reconciliation, owner read models, observability redaction, CSP, and mobile workflows.**
- [ ] **Step 4: Run the complete verification matrix: format, lint, typecheck, all tests, coverage, build, migrations, and E2E smoke.**
- [ ] **Step 5: Commit `docs: document deployment and portfolio verification`.**

### Task 7: Final review and delivery

**Files:**

- Modify only files identified by verification findings.

- [ ] **Step 1: Inspect `git diff --check`, dependency diff, generated files, and all public route/error contracts.**
- [ ] **Step 2: Run a tenant/RBAC/ledger/idempotency regression matrix against a fresh database.**
- [ ] **Step 3: Check git identity is `longhang2004 <nhutlong20112004@gmail.com>` for author and committer.**
- [ ] **Step 4: Report any push blocker explicitly; only push after a valid GitHub remote and authenticated `gh` account are available.**
