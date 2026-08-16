# CODEBASE_CONTEXT.md — StockPilot

Repository-grounded facts for handoff to a planning agent. Everything below is
derived from the current codebase (`main`, post code-architecture refactor;
see `git log` for the current HEAD). No roadmap, no design proposals — only
what exists today.

---

## 1. Tech stack and versions

| Component            | Choice                                                                                                                                    | Evidence                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Package manager      | pnpm **10.13.1** monorepo (`pnpm-workspace.yaml` → `apps/*`, `packages/*`)                                                                | `package.json:5`, `pnpm-workspace.yaml`                                  |
| Runtime              | Node.js **>=24 <25** (`.nvmrc` = 24; CI/Docker use Node 24)                                                                               | `package.json:6-8`, `.nvmrc`, `.github/workflows/ci.yml`                 |
| Web                  | Next.js **16** / React **19.2**, App Router, TypeScript 5.8                                                                               | `apps/web/package.json`, `apps/web/app/`                                 |
| API                  | NestJS **11**, Express platform, Prisma **7** (`@prisma/client`, `@prisma/adapter-pg`), Zod **4**                                         | `apps/api/package.json`, `apps/api/src/`                                 |
| DB                   | PostgreSQL **18** (local/CI via `postgres:18-alpine`), Neon (prod)                                                                        | `docker-compose.yml`, `render.yaml`                                      |
| Auth/crypto          | argon2 (Argon2id), `crypto` (SHA-256, HMAC-SHA256, timingSafeEqual)                                                                       | `apps/api/src/auth/`                                                     |
| Validation/contracts | Shared Zod schemas in modular `@stockpilot/contracts` (no codegen); response contracts are Zod schemas with `z.infer` types               | `packages/contracts/src/`                                                |
| Queue                | pg-boss **12** (opt-in, disabled in default profile)                                                                                      | `apps/api/src/jobs/job-runner.service.ts`                                |
| Images               | Sharp (resize/WebP) + Cloudinary SDK (storage)                                                                                            | `apps/api/src/catalog/product-image-storage.ts`                          |
| Observability        | `@sentry/node` (optional), structured JSON request logging                                                                                | `apps/api/src/observability/`                                            |
| UI styling           | Tailwind CSS v4 wired but effectively unused; hand-written CSS + design tokens; IBM Plex Sans/Mono (local fonts); `@phosphor-icons/react` | `apps/web/app/globals.css`, `apps/web/app/styles/foundation.css`         |
| State (web)          | TanStack React Query v5 (server state), react-hook-form + zod resolvers                                                                   | `apps/web/package.json`, `apps/web/hooks/`                               |
| Testing              | Vitest 3 (unit/integration), Playwright 1.54 (e2e + axe), Supertest                                                                       | root `package.json`, `apps/api/vitest.config.ts`, `playwright.config.ts` |
| SaaS billing         | Stripe (checkout + billing portal + signed webhooks), optional (`STRIPE_*` env)                                                           | `apps/api/src/billing/`                                                  |

## 2. Directory / module structure

```
apps/web              Next.js 16 UI (marketing + signup/login + /app workspace)
apps/api              NestJS 11 API, Prisma 7, optional pg-boss worker
packages/contracts    Shared Zod contracts, modular by domain (built to dist/, workspace:*)
infra/postgres        Role bootstrap (init.sql) + Neon production provisioning SQL
docs                  architecture, deployment, operations, threat-model, erd, test-report, walkthrough
design-system/stockpilot   MASTER.md design-token spec only (no code)
tests/e2e             Playwright specs + helpers
.github/workflows     ci.yml (verify) + deploy-render.yml (migrate/seed + deploy hook)
```

- `apps/api/src/` feature modules: `auth` (sessions/CSRF/signup/demo login/workspaces), `audit`,
  `billing` (Stripe), `catalog` (products/customers/suppliers + product images), `dashboard`,
  `demo` (fixture data + seeding + manual/automatic reset), `health`, `idempotency`,
  `imports` (product CSV), `integrations` (mock-storefront webhook + retry), `inventory`
  (balances/movements/receipts/adjustments/alerts/reconciliation), `jobs` (pg-boss),
  `orders` (draft/transition/query), `organization` (workspace creation + settings + team),
  `team` (invitations + memberships), `analytics`, `observability`, `database`, `config`,
  `openapi` (Zod→OpenAPI projection registry), `validation`. Root wiring in `apps/api/src/app.module.ts`.
- `apps/api/src/generated/prisma/` is generated output (gitignored; `prisma generate`).
- `apps/web/features/` holds one folder per workspace screen: `overview, orders, inventory,
products, partners, receipts, imports, integrations, audit, settings, more` plus `shared/`
  (contract aliases, line-selection helper) and `workspace/` (section registry).
  Each feature owns a small `api.ts` data module (fetchers/mutations/query keys).

## 3. Current user-facing features

- **Marketing landing page** with product tour, JSON-LD, role-based demo CTA (`apps/web/app/page.tsx`).
- **Signup / workspace creation**: `/signup` (creates a user; session issued; no workspace yet),
  `/create-workspace` (POST `/organizations` atomically creates org + warehouse + Owner
  membership and re-issues the session bound to it).
- **One-click demo login** by role (`/login?role=manager|staff|owner`; `POST /auth/demo-login`).
- **Workspace switching**: `GET /auth/workspaces` + `POST /auth/switch-workspace`
  (membership re-verified server-side; new session issued).
- **Invitations**: Owner invites by email (`POST /team/invitations`, Manager/Staff roles only,
  7-day expiry, seat-counted against the plan), revoke, and acceptance via a token link
  (`/invitations/accept?token=…`) that issues a fresh session for the joined workspace.
- **Overview work queue**: draft-order count, open low-stock alerts, failed integration
  deliveries, open-order value, recent orders/movements, 14-day inbound/outbound summary
  (`GET /dashboard/overview`; the `fourteenDayMovements` alias is the only one).
- **Orders**: list w/ search + status filter, detail drawer with line snapshots and transition
  timeline, multi-line draft create/edit, confirm/fulfill/cancel (idempotency-keyed).
- **Inventory**: balances list, low-stock alerts, stock adjustments, multi-line receipt
  creation, movement history.
- **Products**: CRUD + image upload/delete (Cloudinary), CSV export.
- **Partners**: customers + suppliers tabs, CRUD.
- **Imports**: CSV product import preview (row-level errors), commit, errors.csv download.
- **Integrations**: mock-storefront delivery list, payload viewer, manual retry.
- **Audit trail**: paginated audit events with entity-type filter.
- **Settings** (Owner only): org settings, team members (role change/removal with last-owner
  protection), invitations, demo reset, billing card.
- **Billing** (Owner only, non-demo orgs): plan status, Stripe checkout/portal,
  seat-limit-aware entitlements; demo org always shows the synthetic Demo Pro plan.
- **Mobile**: bottom nav (first 3 sections + "More" grid) for the same screens.
- Role-gated UI: Staff sees "Manager access required" on Imports; non-Owners see
  "Owner access required" on Settings.

## 4. Current routes / screens

**Web routes (Next.js App Router)** — all under `apps/web/app/`:

- `/` marketing homepage; `/login` role picker; `/signup`; `/create-workspace`;
  `/invitations/accept` (token link); `/app` workspace shell (defaults to `overview`);
  `/app/[section]` validated against the shared section registry (`features/workspace/sections.ts`),
  unknown → `more`.
- Metadata routes: `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/icon`,
  `/apple-icon`, `/opengraph-image`, `/twitter-image`.
- No `middleware.ts` or `route.ts`; `/api/:path*` is rewritten to the API at
  `API_INTERNAL_URL` in `apps/web/next.config.ts`; strict CSP + security headers set there.
- Workspace sections are defined once in `features/workspace/sections.ts`:
  `overview, orders, inventory, products, partners, receipts, imports, integrations,
audit, settings, more` — the dynamic route whitelist, `WorkspaceSection` type, nav
  labels, and hrefs all derive from it.

**API routes** — global prefix `v1` (`apps/api/src/configure-application.ts`); Swagger at
`/docs`, OpenAPI at `/openapi.json`. Controller-level list in §5.

## 5. Backend modules and APIs

Controllers (all under `apps/api/src/`, URL prefix `v1`):

- **Auth** (`auth/auth.controller.ts`): `POST /auth/login`, `POST /auth/signup` (201),
  `POST /auth/demo-login` (public), `GET /auth/session`, `GET /auth/workspaces`,
  `POST /auth/switch-workspace`, `GET /auth/csrf`, `POST /auth/logout` (204).
- **Health** (`health/health.controller.ts`): `GET /health/live`, `GET /health/ready`
  (503 if DB down, or `QUEUE_REQUIRED` && queue not ready).
- **Catalog** — three explicit controllers: `products.controller.ts` (`GET /products`,
  `GET /products/export.csv`, `GET /products/:id`, `POST /products`, `PATCH /products/:id`,
  `POST /products/:id/image` multipart 5 MB, `DELETE /products/:id/image`),
  `customers.controller.ts` and `suppliers.controller.ts` (`GET`, `GET /:id`, `POST`, `PATCH`).
- **Inventory** (`inventory.controller.ts`): `GET /inventory/balances`,
  `GET /inventory/movements`, `POST /inventory/adjustments` (idempotency key),
  `POST /receipts` (idempotency key), `GET /alerts?status=OPEN|RESOLVED`.
- **Orders** (`orders.controller.ts`): `GET /orders`, `GET /orders/:id`, `POST /orders`
  (draft), `PATCH /orders/:id` (draft lines), `POST /orders/:id/confirm|fulfill|cancel`
  (all idempotency-keyed).
- **Imports** (`product-import.controller.ts`): `POST /product-imports/preview`,
  `POST /product-imports/:id/commit` (idempotency key), `GET /product-imports/:id/errors.csv`.
- **Integrations** (`integration.controller.ts`): `POST /webhooks/mock-storefront/orders`
  (public + CSRF-exempt, HMAC-verified, 202), `GET /integration-deliveries`,
  `POST /integration-deliveries/:id/retry` (idempotency key).
- **Billing** (`billing.controller.ts`): `GET /billing` (Owner), `POST /billing/checkout`,
  `POST /billing/portal` (Owner), `POST /webhooks/stripe` (public + CSRF-exempt,
  signature-verified, raw-body preserved).
- **Organization** (`organization.controller.ts`): `POST /organizations` (201, authenticated,
  not permission-gated — fresh signups need it), `GET /organization/settings`,
  `GET /team`.
- **Team** (`team.controller.ts`): `POST /team/invitations`, `GET /team/invitations`,
  `POST /team/invitations/:id/revoke`, `POST /team/invitations/accept` (authenticated,
  not permission-gated — the invitee may have no membership yet; issues a new session),
  `PATCH /team/members/:membershipId/role`, `DELETE /team/members/:membershipId`.
- **Dashboard** (`dashboard.controller.ts`): `GET /dashboard/overview`.
- **Audit** (`audit.controller.ts`): `GET /audit-events` (entityType filter).
- **Analytics** (`analytics.controller.ts`): `GET /analytics`.
- **Demo** (`demo-reset.controller.ts`): `POST /organization/demo-reset` (Owner, idempotency key).

Only public routes: `POST /auth/login`, `POST /auth/signup`, `POST /auth/demo-login`,
`GET /health/*`, `POST /webhooks/mock-storefront/orders`, `POST /webhooks/stripe`
(both signature-verified).

**Cross-cutting API machinery**:

- `configure-application.ts`: helmet, cookieParser, global `v1` prefix, CORS
  (`credentials: true`, origin = `WEB_ORIGIN`), global `ProblemDetailsFilter`, global
  `RequestLoggingInterceptor`, Swagger.
- `problem-details.filter.ts`: RFC 9457 bodies `{type,title,status,detail,instance,code,
traceId,errors?}`; Zod→400 `VALIDATION_ERROR`, Prisma P2002→409 / P2025→404,
  HttpException→mapped codes, fallback 500.
- `environment.ts`: zod-validated env (required `CSRF_SECRET` ≥32, `DATABASE_URL`,
  `WEB_ORIGIN`, `WEBHOOK_SIGNING_SECRET` ≥16; defaults `DEMO_MODE=true`,
  `DEMO_ORGANIZATION_SLUG=stockpilot-demo`, `QUEUE_REQUIRED=false`, `PORT=4000`,
  `SESSION_COOKIE_NAME=stockpilot_session`, `SESSION_TTL_HOURS=12`; optional Cloudinary,
  Stripe, `MIGRATION_DATABASE_URL`, `QUEUE_DATABASE_URL`, `SENTRY_DSN`, `TRUSTED_PROXY_CIDRS`).

## 6. Database schema / entities and relationships

Prisma schema: `apps/api/prisma/schema.prisma` (23 models); SQL DDL in 11 migrations.

**Auth/tenancy**: `User` (unique email, Argon2id `passwordHash`) ↔ `Membership` (unique
`[organizationId,userId]`, role) ↔ `Organization` (unique slug, `isDemo`,
`nextDemoResetAt`); `Session` (unique `tokenHash` CHAR(64), `expiresAt`, `revokedAt`,
`lastSeenAt`, nullable `membershipId` so a signed-up user can hold a session before
joining any workspace).

**Team**: `OrganizationInvitation` (unique `[organizationId,email]` pending constraint via
partial index, `tokenHash` CHAR(64), `invitedByUserId`, `role`, `expiresAt`,
`acceptedAt`, `revokedAt`; 7-day TTL; only Manager/Staff roles grantable).

**Billing**: `OrganizationSubscription` (1:1 with org, `stripeCustomerId`,
`stripeSubscriptionId`, `plan`, `status`); `BillingWebhookEvent` (unique `eventId` claim
table for Stripe webhook dedup).

**Catalog**: `Warehouse` (one per org — `organizationId` unique), `Product` (unique
`[organizationId,sku]`, `salePrice` Decimal(12,2), `reorderPoint`, `isActive`, nullable
image columns), `Customer`, `Supplier` (unique `[organizationId,id]` composite for
RLS-composite FKs).

**Inventory**: `InventoryBalance` (unique `[organizationId,warehouseId,productId]`,
`onHand`, `reserved`, `version` — projection row); `StockMovement` (append-only ledger:
type RECEIPT|SALE|ADJUSTMENT_IN|ADJUSTMENT_OUT, `quantityDelta`, `onHandAfter`,
`referenceType/Id`, actor); `GoodsReceipt` (unique `[organizationId,receiptNumber]`) +
`GoodsReceiptLine`; `LowStockAlert` (OPEN/RESOLVED).

**Orders**: `SalesOrder` (unique `[organizationId,orderNumber]`, status
DRAFT|CONFIRMED|FULFILLED|CANCELLED, customer snapshot, `subtotal`, per-transition
timestamps); `SalesOrderLine` (unique `[organizationId,salesOrderId,productId]`, SKU/
name/unit-price snapshots, `lineTotal`); `OrderTransition` (append-only, `fromStatus`/
`toStatus`/actor/note).

**Cross-cutting**: `AuditEvent` (JSONB before/after, actor); `IdempotencyRecord` (unique
`[organizationId,scope,key]`, SHA-256 payload `fingerprint`, stored
`responseStatus`/`responseBody`, `expiresAt`); `IntegrationDelivery` (unique
`[organizationId,externalDeliveryId]`, status RECEIVED|PROCESSING|SUCCEEDED|FAILED,
attempts, lastError, optional `salesOrderId`); `ProductImportRun` (status, row counts,
`validRows`/`errors` JSONB).

**Database-level invariants (migrations)**:

- Check constraints: `inventory_balances on_hand >= reserved AND reserved >= 0`;
  `stock_movements quantity_delta <> 0`, `on_hand_after >= 0`, adjustment rows require
  non-blank reason; `products sale_price >= 0`, `reorder_point >= 0`; receipt line
  `quantity > 0`, `unit_cost NULL or >= 0`; `sales_orders subtotal >= 0`, line
  `quantity > 0`, `unit_price/line_total >= 0`; alert OPEN⇔`resolved_at IS NULL`;
  idempotency `response_status 200-599`.
- Partial unique index: one OPEN alert per balance; one pending invitation per
  `[organizationId,email]`.
- **RLS**: every tenant table `ENABLE` + `FORCE ROW LEVEL SECURITY` with a
  `*_tenant_isolation` policy on `organization_id = NULLIF(current_setting('app.current_org_id', true),'')::uuid`.
  `users/organizations/memberships/sessions/organization_invitations/organization_subscriptions/billing_webhook_events`
  are not RLS-protected (scoped by application logic — org id always part of the query).
- **Append-only privileges**: `stock_movements`, `goods_receipts`, `goods_receipt_lines`,
  `audit_events`, `order_transitions` are SELECT/INSERT only; DELETE revoked on
  `sales_orders`, `integration_deliveries`, `product_import_runs`.
- Three SECURITY DEFINER functions, each narrowly granted:
  `stockpilot_reset_demo_data(uuid)` (demo-org-guarded reset),
  `stockpilot_resolve_invitation(char(64))` (invitation lookup without tenant context),
  `stockpilot_sync_subscription(...)` (Stripe webhook apply + event-id claim).

## 7. Authentication / authorization model

- **Sessions**: opaque 32-byte base64url token; only SHA-256 hash stored
  (`sessions.token_hash`). HttpOnly cookie (`SESSION_COOKIE_NAME`), `sameSite: 'lax'`,
  `secure` in production, TTL from `SESSION_TTL_HOURS` (12 h). Login looks up user by
  lowercased email, verifies Argon2id. Signup issues a session with no membership.
- **Guard chain** (all registered as `APP_GUARD`s in `auth/auth.module.ts`):
  `SessionGuard` → `CsrfGuard` → `PermissionGuard` → `RateLimitGuard`. `@Public()` skips
  session guard; `@CsrfExempt()` skips CSRF.
- **CSRF**: safe methods pass; non-safe requests need `Origin === WEB_ORIGIN` and, when
  authenticated, `x-csrf-token` = HMAC-SHA256(CSRF_SECRET, sessionTokenHash) via
  `timingSafeEqual`; token fetched via `GET /auth/csrf`.
- **RBAC** (`auth/rbac.ts`, permissions on every controller via `@RequirePermission`):
  - STAFF: `analytics:read, catalog:read, inventory:read, order:read, order:draft:write, order:fulfill`
  - MANAGER: STAFF + `audit:read, catalog:write, integration:retry, inventory:adjust, inventory:receive, order:cancel, order:confirm`
  - OWNER: MANAGER + `billing:read, billing:write, organization:reset-demo, organization:settings:read/write, team:invite, team:read, team:write`
- **Tenant context**: services wrap DB work in `TenantDatabase.withTenant({organizationId, actorId}, tx)`
  which sets Postgres GUCs `app.current_org_id` / `app.current_actor_id`
  transaction-locally; RLS enforces row isolation. Org id always derived from the
  session, never from the client.
- **Rate limiting** (`auth/rate-limit.guard.ts` + `auth/auth-throttle.service.ts`):
  fixed 60 s windows, in-memory. Three tiers: auth routes 10/min per client+route
  (login/signup/demo-login), other public writes 60/min per client+route, authenticated
  writes 240/min per user. Per-account sign-in throttle: 5 failures per (email, client)
  in 15 min → 429 block for 15 min; success clears. Unknown-email logins verify a dummy
  argon2 hash to equalize timing. Stats (buckets + per-tier rejected) on `/v1/health/ready`.
  Public tiers are keyed by the socket peer (or first untrusted `x-forwarded-for` hop when
  the peer is inside `TRUSTED_PROXY_CIDRS`); the user tier is keyed by user id.
- **Demo auth**: `POST /auth/demo-login` requires `DEMO_MODE`, resolves the demo org
  membership by role + `DEMO_ORGANIZATION_SLUG`, and delegates due auto-reset to the
  demo domain before continuing the login flow. Demo passwords are `StockPilotDemo!`.

## 8. Existing third-party integrations

- **Cloudinary** (optional): product image upload, 640×640 padded auto-format delivery
  URLs; orphan cleanup on failure.
- **Mock storefront webhook** (built-in): `POST /webhooks/mock-storefront/orders` with
  `x-delivery-id`, `x-organization-slug`, `x-storefront-signature` (HMAC-SHA256,
  `timingSafeEqual`); creates a Draft order `STORE-{externalOrderId}-{timestamp}`,
  reuses-or-creates the customer by email; failed delivery → optional queue retry job.
- **Stripe** (optional): checkout sessions, billing portal, signed webhooks
  (`customer.subscription.{created,updated,deleted}`) applied via the
  `stockpilot_sync_subscription` SECURITY DEFINER with event-id dedup; unknown prices/
  statuses dropped without syncing.
- **pg-boss** (opt-in): retry/dead-letter/reconcile queues + 15-min reconciliation cron;
  starts only when `QUEUE_DATABASE_URL` set.
- **Sentry** (optional, `SENTRY_DSN`): error capture with trace context.
- **Next.js image optimizer** allows `res.cloudinary.com` remote images.

## 9. Important business logic and invariants

- **Inventory projection**: `available = onHand - reserved`; every mutation goes through
  `projectInventory` which throws unless `onHand >= 0` and `0 <= reserved <= onHand`;
  balances upserted + locked `FOR UPDATE` in **sorted product order** (deadlock
  avoidance) via `lockInventoryBalance`.
- **Receipts**: one transaction — validate warehouse/supplier/all products active, lock
  balances by sorted productId, project `onHandDelta`, write GoodsReceipt + lines +
  RECEIPT `StockMovement` + low-stock reconcile + audit.
- **Adjustments**: `ADJUSTMENT_IN` adds / `ADJUSTMENT_OUT` subtracts with required
  `reason`; invariant violation → 409.
- **Order state machine**: `DRAFT → {CANCELLED, CONFIRMED}`; `CONFIRMED → {CANCELLED,
FULFILLED}`; `CANCELLED`/`FULFILLED` terminal; invalid transitions → conflict.
- **Confirm**: row lock `FOR UPDATE`, require `onHand - reserved >= line.quantity` per
  line, increment `reserved`; **Fulfill**: decrement `onHand` and `reserved`, write
  `SALE` movement; **Cancel-from-CONFIRMED**: release reservation only; each transition
  writes an `OrderTransition` row + audit. All three idempotency-keyed.
- **Draft orders**: server-side subtotal from current `salePrice` (client prices never
  trusted — no price in `SalesOrderInputSchema`), order number
  `SO-{Date.now()}-{uuid8}`, SKU/name/unit-price snapshots; draft lines replaceable only
  while DRAFT.
- **Idempotency**: `executeIdempotent` — `pg_advisory_xact_lock(hashtextextended(orgId:scope:key))`,
  then `IdempotencyRecord` lookup; same payload fingerprint → replay stored response;
  different payload → 409; 24 h expiry. Scopes: `receipt:create`, `inventory:adjustment`,
  `order:transition:{status}`, `product-import:commit`, `integration:retry`,
  `organization:demo-reset`, `webhook:mock-storefront:order`. Order create/PATCH and
  product/partner POST/PATCH are intentionally NOT idempotency-keyed.
- **Webhook dedup**: deliveries unique on `(organizationId, externalDeliveryId)`.
- **CSV imports**: 2 MB / 5,000-row caps, required headers `sku,name,sale_price,
reorder_point`, custom quoting-aware parser, preview flags duplicate/existing SKUs,
  commit idempotent and requires PREVIEW status.
- **Low-stock alerts**: opened/resolved within the same transaction as stock mutations;
  also reconciled by the optional scheduled job.
- **Team seats**: invitation creation counts members + pending invitations against the
  plan's `maxTeamMembers`; acceptance re-checks members-only inside the transaction.
  Every team-seat mutation takes `pg_advisory_xact_lock('team:{orgId}')` explicitly.
  Last-owner demotion/removal is rejected. Invitation acceptance resolves through the
  SECURITY DEFINER lookup, requires the email to match the authenticated user, and
  issues a fresh session for the joined workspace.
- **Demo reset**: manual (Owner, `executeIdempotent`, audit `DEMO_RESET` with the
  requesting actor) and automatic (due-time check before demo login,
  `demo-reset:{orgId}` advisory lock, audit `DEMO_RESET_AUTOMATIC` under the demo owner
  actor) both live in `DemoResetService`; `AuthService` only asks whether a reset is due.
  Reset deletes operational rows via the SQL function → reseeds the deterministic
  fixture → schedules next reset (6 h).
- **Demo fixture**: stable declarations in `demo/demo-fixture-data.ts` (9 products —
  8 active, 5 customers, 3 suppliers, 8 balances, 1 receipt with 8 lines, 6 orders
  across statuses, 2 open alerts, 1 failed delivery, 1 preview import, 6 audit events;
  deterministic SHA-1 UUIDs `stockpilot-demo-fixture:v1:{org}:{key}`) seeded by the
  orchestration in `demo/demo-fixture.ts`; counts and IDs are load-bearing for the
  integration/e2e suites.
- **Tenant isolation is DB-enforced**: runtime role `NOBYPASSRLS`, RLS FORCE on all
  tenant tables.

## 10. Shared contracts (`@stockpilot/contracts`)

- Modular by domain: `common` (uuid/date/money/pagination), `problem-details`,
  `auth` (roles/plans/session/workspace), `catalog` (product/partner inputs + response
  shapes), `inventory` (receipt/adjustment inputs + balances/movements/alerts/results),
  `orders` (order input + list/detail/lines/transitions), `billing`, `integrations`,
  `imports`, `audit`, `analytics`, plus a backwards-compatible barrel `index.ts`.
- Input schemas are parsed by the API controllers. Shared wire contracts are
  centralized in `@stockpilot/contracts`: most response contracts are Zod schemas
  whose inferred types describe the JSON wire shape (dates and money as strings)
  and are used where runtime/OpenAPI projection provides value; a few (e.g.
  `OverviewResponse`) are type-only contracts consumed read-only by the web
  client — no browser runtime response parsing anywhere.
- The OpenAPI projection in `apps/api/src/openapi/schemas.ts` imports the shared
  response schemas (plus API-local request schemas from the domain schema modules),
  so the documented contract cannot drift from the serializers.

## 11. Testing setup and what is currently covered

Commands: `pnpm test:unit` (contracts + api + web unit), `pnpm --filter @stockpilot/api
test:integration`, `pnpm test:e2e` (Playwright), plus `format:check`, `lint`,
`typecheck`, `typecheck:e2e`, `build`.

- **API unit** (vitest, `src/**/*.spec.ts`): pure-domain only — rbac matrix,
  session-credentials, permission guard, rate limiter, CIDR/client-address, inventory
  projection, order state machine, CSV parser, storefront signature, idempotency
  fingerprint, product-image storage/cloudinary/service, environment, redaction,
  job-runner, health controller, prisma service, organization service, catalog mappers,
  demo fixture data (deterministic IDs + count consistency), problem details/status.
- **API integration** (vitest + Supertest against real Postgres, `apps/api/test/*.integration.spec.ts`):
  auth/session/CSRF/origin, signup/workspace creation, team onboarding (invite/accept/
  revoke/expiry/email-mismatch/seat limits/role changes/last-owner/workspace switching),
  billing (Stripe webhook sync, downgrade re-checks seats, demo disabled), catalog +
  tenant-scoped dashboard + CSV import preview/commit/errors/export, orders (price
  snapshots, role split, transitions, reservation, cancellation release,
  concurrent-confirm serialization), receipts/adjustments/alerts (idempotent replay,
  409 on key reuse, over-adjust 409, Staff forbidden), integrations (HMAC, dedup,
  retry, bad signature 401), demo seed idempotency + owner reset + auto-reset,
  health/readiness, tenant isolation/RLS + one-warehouse constraint + append-only
  ledger, OpenAPI contract surface, analytics, migration safety. Shared infrastructure
  (environment bootstrap, Nest app creation, demo-login agents) lives in
  `apps/api/test/support/`; RLS/concurrency/security scenarios keep their local setup
  where it is semantically meaningful.
- **Contracts unit** (11 tests): enums, problem details, input normalization,
  receipt/adjustment/order line rules, and serializer wire-shape response contracts.
- **Web unit** (~30 tests): homepage, SEO metadata contract, workspace shell
  (session/expired), demo-login card, signup form, operations-ui, workspace boundaries
  (role-gated actions), api-client (FormData/CSRF), overview workspace, receipts
  workspace, workspace navigation.
- **E2E** (Playwright, `tests/e2e/`, 28 tests across desktop Chrome + Pixel 5):
  accessibility (axe critical/serious), SEO/robots/sitemap/noindex/overflow/keyboard,
  duplicate-webhook (HMAC + dedup), manager receipt→draft→confirm + staff fulfill,
  staff sees no confirm buttons, owner reset + team visibility, mobile
  receipt-to-fulfillment, SaaS onboarding (signup → create workspace → invite →
  accept; duplicate-signup rejection). `webServer: node scripts/e2e-server.mjs`
  (API readiness-gated; needs seeded Postgres).
- **CI** (`.github/workflows/ci.yml`): single `verify` job with Postgres 18 service —
  install → archive self-test → audit → `init.sql` roles → generate → migrate →
  seed → format → lint → typecheck → typecheck:e2e → unit → integration → coverage →
  build → e2e.
- **Coverage gates**: per-file branch thresholds ≥80% for `auth/rbac.ts`,
  `idempotency/idempotency.ts`, `inventory/inventory-projection.ts`,
  `orders/order-state-machine.ts`. Aggregate API unit coverage is low because
  DB-backed layers are exercised only by integration tests.
- **Known gaps**: no e2e for imports wizard, integrations/retry UI, adjustments UI,
  audit screen, overview chart, settings/team beyond reset, logout, session-expired
  (unit only), toasts; no web coverage numbers; no cross-browser e2e (Chromium only);
  no integration test for product-image upload, Sentry, or queue-worker/retry jobs.

## 12. Deployment / demo setup

- **Topology**: Vercel (Next.js, same-origin `/api` proxy) → Render Free (NestJS API +
  migrations) → Neon (Postgres); optional Neon queue DB for pg-boss; UptimeRobot
  keep-warm.
- **Local**: `cp .env.example .env && pnpm install && docker compose up -d postgres &&
pnpm db:generate && pnpm db:migrate && pnpm db:seed && pnpm dev` — web on :3000,
  API + Swagger on :4000. `docker-compose.yml` runs api/web/postgres with
  `infra/postgres/init.sql` role bootstrap; the API container runs migrate → seed →
  start.
- **`render.yaml`**: one Free Docker web service (`stockpilot-api`), health check
  `/v1/health/ready`, `QUEUE_REQUIRED=false`.
- **`apps/web/vercel.json`**: builds contracts then web.
- **`deploy-render.yml`**: after CI on `main`, runs `prisma migrate deploy` + idempotent
  `db:seed` against Neon, then optionally triggers `RENDER_DEPLOY_HOOK_URL`.
- **Demo data**: seeded idempotently on first deploy and after every 6-hour reset; demo
  org slug `stockpilot-demo` ("Harbor & Pine Wholesale"); three accounts
  (`owner@|manager@|staff@stockpilot-demo.stockpilot.test`, password `StockPilotDemo!`);
  one-click login from the landing page.

## 13. Existing mock / stub / incomplete functionality

- **Mock storefront webhook** is the only "integration" — a built-in mock endpoint for
  demo purposes; real marketplace integrations are out of scope.
- **No mock data in the web app**: every screen calls the live API; unit tests stub
  `fetch`.
- **Overview "chart" is an HTML table** ("Accessible table summary"), not a chart.
- **"More" screen** is a bare link grid.
- **No server-side auth guard**: `/app` pages are unauthenticated HTML shells; auth is
  client-side session check → "expired"/"no membership" screens. No
  `loading/error/not-found` boundary files; per-screen skeletons/error states
  hand-rolled.
- **Queue worker opt-in**: reconciliation and automatic retry jobs only run when
  `QUEUE_DATABASE_URL` is configured (disabled in all deployed profiles).
- **Email transport**: none — invitation tokens are returned once and shared via a
  copy-link; demo passwords are fixed.
- **Scope-declared non-features** (README "Scope"): payments (Stripe billing exists for
  plans/seats but no invoicing), tax, debt, returns, purchase orders, partial
  receiving/fulfillment, variants, barcodes, lot/serial tracking, valuation, multiple
  warehouses, Redis, marketplace integrations.

## 14. Technical debt relevant to adding new features

- **Weak coverage gates**: only 4 files have branch thresholds; DB-backed
  controllers/services/guards have 0% unit coverage (integration-only); no web
  coverage; no cross-browser e2e.
- **Free-tier demo constraints** baked into the architecture: `QUEUE_REQUIRED=false`
  default, no always-on worker, Render sleep/wake, Neon CU budget.
- **Single-warehouse-per-org** is a hard DB constraint — multi-warehouse requires
  schema + RLS-composite FK changes.
- **Auth/team/billing tables not RLS-enforced** — tenant scoping relies on application
  logic (org id always in the query, documented per method).
- **In-memory rate limiter** is per-instance, not shared across replicas.
- **Prisma-generated code** lives inside `apps/api/src/generated/` (gitignored;
  regenerated by `db:generate`).
- **`clearCsrfToken`** in the web client is only exercised by unit tests (kept as the
  documented cache-reset for logout flows).
- **Tailwind v4 wired but effectively unused** — hand-written CSS on design tokens;
  two parallel styling systems (deliberate: the UI/UX program owns this decision).

## 15. Extension points relevant to future development

- **`packages/contracts`** is the single source of truth for input validation and
  shared response shapes (Zod + `z.infer`); adding a feature = add schemas in the
  matching domain module first, re-export via the barrel.
- **RBAC matrix** (`auth/rbac.ts`) is a flat permission set per role; new capabilities
  are one permission string + decorator on the controller.
- **Idempotency wrapper** (`idempotency/idempotency.ts`) is generic — any
  state-changing endpoint can opt in with a scope string + `Idempotency-Key` header.
- **pg-boss job runner** defines queue naming, retry/backoff/dead-letter and cron
  conventions; adding background work = register a queue + worker there.
- **`TenantDatabase.withTenant`** centralizes the tenant-context pattern every service
  must follow to get RLS isolation.
- **`ProblemDetailsFilter`** maps Zod/Prisma/HttpException errors globally.
- **Demo fixture data** (`demo/demo-fixture-data.ts`) has counted fixture declarations
  - deterministic IDs, wired into seed/reset/auto-reset; integration/e2e suites assert
    the counts, so fixture changes must keep them in sync.
- **Audit trail** is a generic JSONB before/after recorder (`audit/audit-record.ts`).
- **OpenAPI registry** (`openapi/schemas.ts`) maps Zod schemas to named components;
  new endpoints reference them via `schemaRef(...)`.
- **Workspace section registry** (`features/workspace/sections.ts`): adding a screen =
  one entry there, then the component mapping in `workspace-content.tsx` and (optional)
  nav entry in `workspace-navigation.tsx`.
- **Design tokens** in `design-system/stockpilot/MASTER.md` +
  `apps/web/app/styles/foundation.css` define the component vocabulary for the
  upcoming UI/UX program.
