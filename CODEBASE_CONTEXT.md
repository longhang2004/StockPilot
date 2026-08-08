# CODEBASE_CONTEXT.md — StockPilot

Repository-grounded facts for handoff to a planning agent. Everything below is
derived from the current codebase (`main` @ `035d2ae`). No roadmap, no design
proposals — only what exists today.

---

## 1. Tech stack and versions

| Component            | Choice                                                                                                                                    | Evidence                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Package manager      | pnpm **10.13.1** monorepo (`pnpm-workspace.yaml` → `apps/*`, `packages/*`)                                                                | `package.json:5`, `pnpm-workspace.yaml`                                                                 |
| Runtime              | Node.js **>=24 <25** (`.nvmrc` = 24; CI/Docker use Node 24)                                                                               | `package.json:6-8`, `.nvmrc`, `.github/workflows/ci.yml:30-34`                                          |
| Web                  | Next.js **16** / React **19.2**, App Router, TypeScript 5.8                                                                               | `apps/web/package.json:14-27`                                                                           |
| API                  | NestJS **11**, Express platform, Prisma **7** (`@prisma/client`, `@prisma/adapter-pg`), Zod **4**                                         | `apps/api/package.json:20-40`                                                                           |
| DB                   | PostgreSQL **18** (local/CI via `postgres:18-alpine`), Neon (prod)                                                                        | `docker-compose.yml:30`, `render.yaml`                                                                  |
| Auth/crypto          | argon2 (Argon2id), `crypto` (SHA-256, HMAC-SHA256, timingSafeEqual)                                                                       | `apps/api/package.json:31`, `apps/api/src/auth/auth.service.ts:3`                                       |
| Validation/contracts | Hand-written Zod schemas in shared `@stockpilot/contracts` (no codegen)                                                                   | `packages/contracts/src/index.ts`                                                                       |
| Queue                | pg-boss **12** (opt-in, disabled in default profile)                                                                                      | `apps/api/package.json:33`, `apps/api/src/jobs/job-runner.service.ts`                                   |
| Images               | Sharp (resize/WebP) + Cloudinary SDK (storage)                                                                                            | `apps/api/package.json:34,32`, `apps/api/src/catalog/product-image-storage.ts`                          |
| Observability        | `@sentry/node` (optional), structured JSON request logging                                                                                | `apps/api/package.json:29`, `apps/api/src/observability/`                                               |
| UI styling           | Tailwind CSS v4 wired but effectively unused; hand-written CSS + design tokens; IBM Plex Sans/Mono (local fonts); `@phosphor-icons/react` | `apps/web/app/globals.css:1-9`, `apps/web/app/styles/foundation.css`, `apps/web/package.json:15,17`     |
| State (web)          | TanStack React Query v5 (server state), react-hook-form + zod resolvers                                                                   | `apps/web/package.json:16,18,19`                                                                        |
| Testing              | Vitest 3 (unit/integration), Playwright 1.54 (e2e + axe), Supertest                                                                       | root `package.json:24-31`, `apps/api/package.json:41-55`                                                |
| Version              | All packages `0.1.0`                                                                                                                      | `package.json:3`, `apps/api/package.json`, `apps/web/package.json`, `packages/contracts/package.json:2` |

## 2. Directory / module structure

```
apps/web              Next.js 16 UI (marketing + /app workspace)
apps/api              NestJS 11 API, Prisma 7, optional pg-boss worker
packages/contracts    Shared Zod input schemas + enums (built to dist/, consumed as workspace:*)
infra/postgres        Role bootstrap (init.sql) + Neon production provisioning SQL
docs                  architecture, deployment, operations, threat-model, erd, test-report, walkthrough
design-system/stockpilot   MASTER.md design-token spec only (no code)
tests/e2e             Playwright specs + helpers
.github/workflows     ci.yml (verify) + deploy-render.yml (migrate/seed + deploy hook)
```

- `apps/api/src/` feature modules: `auth`, `audit`, `catalog` (products/customers/suppliers + product images), `dashboard`, `demo` (fixture + reset), `health`, `idempotency`, `imports` (product CSV), `integrations` (mock-storefront webhook + retry), `inventory` (balances/movements/receipts/adjustments/alerts/reconciliation), `jobs` (pg-boss), `orders` (draft/transition/query), `organization`, `observability`, `database`, `config`. Root wiring in `apps/api/src/app.module.ts`.
- `apps/api/src/generated/prisma/` is generated output (gitignored; `schema.prisma:1-4`).
- `apps/web/features/` holds one folder per workspace screen: `overview, orders, inventory, products, partners, receipts, imports, integrations, audit, settings, more` (+ `shared/types.ts`).

## 3. Current user-facing features

- **Marketing landing page** with product tour, JSON-LD, role-based demo CTA (`apps/web/app/page.tsx`).
- **One-click demo login** by role (`/login?role=manager|staff|owner`; `components/auth/demo-login-card.tsx`).
- **Overview work queue**: draft-order count, open low-stock alerts, failed integration deliveries, open-order value, recent orders/movements, 14-day inbound/outbound summary (`features/overview/overview-workspace.tsx`, API `GET /dashboard/overview`).
- **Orders**: list w/ search + status filter, detail drawer with line snapshots and transition timeline, draft create/edit, confirm/fulfill/cancel (`features/orders/`).
- **Inventory**: balances list, low-stock alerts, stock adjustments, receipt creation, movement history (`features/inventory/`, `features/receipts/`).
- **Products**: CRUD + image upload/delete (Cloudinary), CSV export (`features/products/`).
- **Partners**: customers + suppliers tabs, CRUD (`features/partners/`).
- **Imports**: CSV product import preview (row-level errors), commit, errors.csv download (`features/imports/`).
- **Integrations**: mock-storefront delivery list, payload viewer, manual retry (`features/integrations/`).
- **Audit trail**: paginated audit events with entity-type filter (`features/audit/`).
- **Settings** (Owner only): org settings, team view, canonical demo reset (`features/settings/`).
- **Mobile**: bottom nav (first 3 sections + "More" grid) for the same screens (`components/app/workspace-navigation.tsx:115-145`).
- Role-gated UI: Staff sees "Manager access required" on Imports (`features/imports/imports-workspace.tsx:51-63`); non-Owners see "Owner access required" on Settings (`features/settings/settings-workspace.tsx:62-74`).

## 4. Current routes / screens

**Web routes (Next.js App Router)** — all under `apps/web/app/`:

- `/` marketing homepage (`page.tsx`); `/login` role picker (`login/page.tsx`, `login/layout.tsx` noindex); `/app` workspace shell (`app/page.tsx` → defaults to `overview`); `/app/[section]` with whitelist `audit|imports|integrations|inventory|more|orders|partners|products|receipts|settings`, unknown → `more` (`app/[section]/page.tsx:6-25`).
- Metadata routes: `/robots.txt` (`robots.ts`), `/sitemap.xml` (`sitemap.ts`), `/manifest.webmanifest` (`manifest.ts`), `/icon`, `/apple-icon`, `/opengraph-image`, `/twitter-image` (`icon.tsx`, `apple-icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`).
- **No** `middleware.ts`, `route.ts`, `loading.tsx`, `error.tsx`, or `not-found.tsx` exist.
- `/api/:path*` is rewritten to the API at `API_INTERNAL_URL` (default `http://localhost:4000`) in `apps/web/next.config.ts:37-46`; strict CSP + security headers set in `next.config.ts:18-36`.

**API routes** — global prefix `v1` (`apps/api/src/configure-application.ts:16`); Swagger at `/docs`, OpenAPI at `/openapi.json`. Full controller-level list in §5.

## 5. Backend modules and APIs

Controllers (all under `apps/api/src/`, URL prefix `v1`):

- **Auth** (`auth/auth.controller.ts:52`): `POST /auth/login` (public), `POST /auth/demo-login` (public, body `{role}`), `GET /auth/session`, `GET /auth/csrf`, `POST /auth/logout` (204).
- **Health** (`health/health.controller.ts:15`): `GET /health/live`, `GET /health/ready` (503 if DB down, or `QUEUE_REQUIRED` && queue not ready).
- **Catalog** (`catalog/catalog.controller.ts`): Products — `GET /products`, `GET /products/export.csv`, `GET /products/:id`, `POST /products`, `PATCH /products/:id`, `POST /products/:id/image` (multipart, 5 MB limit), `DELETE /products/:id/image`; Customers & Suppliers — `GET /customers|/suppliers`, `GET .../:id`, `POST`, `PATCH` (lines 145-233).
- **Inventory** (`inventory/inventory.controller.ts:37`): `GET /inventory/balances`, `GET /inventory/movements`, `POST /inventory/adjustments` (idempotency key), `POST /receipts` (idempotency key), `GET /alerts?status=OPEN|RESOLVED`.
- **Orders** (`orders/orders.controller.ts:37`): `GET /orders`, `GET /orders/:id`, `POST /orders` (draft), `PATCH /orders/:id` (draft lines), `POST /orders/:id/confirm|fulfill|cancel` (all idempotency-keyed).
- **Imports** (`imports/product-import.controller.ts:33`): `POST /product-imports/preview`, `POST /product-imports/:id/commit` (idempotency key), `GET /product-imports/:id/errors.csv`.
- **Integrations** (`integrations/integration.controller.ts:38`): `POST /webhooks/mock-storefront/orders` (public + CSRF-exempt, HMAC-verified, 202), `GET /integration-deliveries`, `POST /integration-deliveries/:id/retry` (idempotency key).
- **Organization** (`organization/organization.controller.ts:9`): `GET /organization/settings`, `GET /team`.
- **Dashboard** (`dashboard/dashboard.controller.ts:9`): `GET /dashboard/overview`.
- **Audit** (`audit/audit.controller.ts:16`): `GET /audit-events` (entityType filter).
- **Demo** (`demo/demo-reset.controller.ts:24`): `POST /organization/demo-reset` (Owner, idempotency key).

Only public routes: `POST /auth/login`, `POST /auth/demo-login`, `GET /health/*`, `POST /webhooks/mock-storefront/orders` (signature-verified).

**Cross-cutting API machinery**:

- `configure-application.ts:11-40`: helmet, cookieParser, global `v1` prefix, CORS (`credentials: true`, origin = `WEB_ORIGIN`), global `ProblemDetailsFilter`, global `RequestLoggingInterceptor`, Swagger.
- `problem-details.filter.ts`: RFC 9457 bodies `{type,title,status,detail,instance,code,traceId,errors?}`; Zod→400 `VALIDATION_ERROR`, Prisma P2002→409 / P2025→404, HttpException→mapped codes, fallback 500.
- `environment.ts:3-31`: zod-validated env (required `CSRF_SECRET` ≥32, `DATABASE_URL`, `WEB_ORIGIN`, `WEBHOOK_SIGNING_SECRET` ≥16; defaults `DEMO_MODE=true`, `DEMO_ORGANIZATION_SLUG=stockpilot-demo`, `QUEUE_REQUIRED=false`, `PORT=4000`, `SESSION_COOKIE_NAME=stockpilot_session`, `SESSION_TTL_HOURS=12`; optional Cloudinary, `MIGRATION_DATABASE_URL`, `QUEUE_DATABASE_URL`, `SENTRY_DSN`).

## 6. Database schema / entities and relationships

Prisma schema: `apps/api/prisma/schema.prisma` (14 models); SQL DDL in 8 migrations under `apps/api/prisma/migrations/`.

**Auth/tenancy (not RLS-enforced)**: `User` (unique email, Argon2id `passwordHash`) ↔ `Membership` (unique `[organizationId,userId]`, role) ↔ `Organization` (unique slug, `isDemo`, `nextDemoResetAt`); `Session` (unique `tokenHash` CHAR(64), `expiresAt`, `revokedAt`, `lastSeenAt`, FK→membership). `schema.prisma:42-114`.

**Catalog**: `Warehouse` (one per org — `organizationId` unique), `Product` (unique `[organizationId,sku]`, `salePrice` Decimal(12,2), `reorderPoint`, `isActive`, nullable image columns), `Customer`, `Supplier` (unique `[organizationId,id]` composite for RLS-composite FKs). `schema.prisma:116-197`.

**Inventory**: `InventoryBalance` (unique `[organizationId,warehouseId,productId]`, `onHand`, `reserved`, `version` — projection row); `StockMovement` (append-only ledger: type RECEIPT|SALE|ADJUSTMENT_IN|ADJUSTMENT_OUT, `quantityDelta`, `onHandAfter`, `referenceType/Id`, actor); `GoodsReceipt` (unique `[organizationId,receiptNumber]`) + `GoodsReceiptLine`; `LowStockAlert` (OPEN/RESOLVED). `schema.prisma:199-293`.

**Orders**: `SalesOrder` (unique `[organizationId,orderNumber]`, status DRAFT|CONFIRMED|FULFILLED|CANCELLED, snapshot of customer company/contact/email, `subtotal`, timestamps per transition); `SalesOrderLine` (unique `[organizationId,salesOrderId,productId]`, SKU/name/unit-price snapshots, `lineTotal`); `OrderTransition` (append-only, `fromStatus`/`toStatus`/actor/note). `schema.prisma:330-393`.

**Cross-cutting**: `AuditEvent` (JSONB before/after, actor); `IdempotencyRecord` (unique `[organizationId,scope,key]`, SHA-256 payload `fingerprint`, stored `responseStatus`/`responseBody`, `expiresAt`); `IntegrationDelivery` (unique `[organizationId,externalDeliveryId]`, status RECEIVED|PROCESSING|SUCCEEDED|FAILED, attempts, lastError, optional `salesOrderId`); `ProductImportRun` (status, rows counts, `validRows`/`errors` JSONB). `schema.prisma:295-432`.

**Key relationships**: Organization 1:1 Warehouse; Product→Balance+Movements+Alert; receipt lines/product; SalesOrder→Lines→product; all tenant tables cascade on org delete, ledger tables `ON DELETE RESTRICT` to warehouse/product. Composite `(organizationId, id)` unique keys on org-scoped parents enable RLS-composite FKs (e.g. `inventory_balances` → `warehouses(organization_id,id)`), `schema.prisma:129,158,208-209`.

**Database-level invariants (migrations)**:

- Check constraints: `inventory_balances on_hand >= reserved AND reserved >= 0`; `stock_movements quantity_delta <> 0`, `on_hand_after >= 0`, adjustment rows require non-blank reason; `products sale_price >= 0`, `reorder_point >= 0`; receipt line `quantity > 0`, `unit_cost NULL or >= 0`; `sales_orders subtotal >= 0`, line `quantity > 0`, `unit_price/line_total >= 0`; alert OPEN⇔`resolved_at IS NULL`; idempotency `response_status 200-599` (`20260804110000_add_catalog_inventory/migration.sql`, `20260804120000_add_sales_orders/migration.sql:22-38`).
- Partial unique index: one OPEN alert per balance (`20260804110000_add_catalog_inventory/migration.sql:209-211`).
- **RLS**: every tenant table `ENABLE` + `FORCE ROW LEVEL SECURITY` with a `*_tenant_isolation` policy on `organization_id = NULLIF(current_setting('app.current_org_id', true),'')::uuid` (e.g. `20260804032400_init_auth_tenancy/migration.sql:117-134`). `users/organizations/memberships/sessions` are not RLS-protected.
- **Append-only privileges**: `stock_movements`, `goods_receipts`, `goods_receipt_lines`, `audit_events`, `order_transitions` are SELECT/INSERT only (UPDATE/DELETE revoked in `20260804111500_harden_append_only_privileges/migration.sql:3-8`); DELETE revoked on `sales_orders`, `integration_deliveries`, `product_import_runs`.
- One DB function, no triggers: `stockpilot_reset_demo_data(uuid)` SECURITY DEFINER, demo-org-guarded, deletes operational rows in FK-safe order (`20260804130000_add_demo_reset_function/migration.sql:1-37`).

## 7. Authentication / authorization model

- **Sessions**: opaque 32-byte base64url token; only SHA-256 hash stored (`sessions.token_hash`, unique). HttpOnly cookie (`SESSION_COOKIE_NAME`), `sameSite: 'lax'`, `secure` in production, TTL from `SESSION_TTL_HOURS` (12 h) (`auth/session-credentials.ts:13-18`, `auth/auth.controller.ts:116-127`, `auth/auth.service.ts:155-187`). Login looks up user by lowercased email, verifies Argon2id (`auth.service.ts:31-51`).
- **Guard chain** (all registered as `APP_GUARD`s in `auth/auth.module.ts:16-21`): `SessionGuard` → `CsrfGuard` → `PermissionGuard` → `RateLimitGuard`. `@Public()` skips session guard; `@CsrfExempt()` skips CSRF (`auth/csrf.guard.ts:26-31`).
- **CSRF**: safe methods pass; non-safe requests need `Origin === WEB_ORIGIN` and, when authenticated, `x-csrf-token` = HMAC-SHA256(CSRF_SECRET, sessionTokenHash) via `timingSafeEqual`; token fetched via `GET /auth/csrf` (`auth/csrf.guard.ts`, `auth/session-credentials.ts:26-48`).
- **RBAC** (`auth/rbac.ts:3-56`, permissions on every controller via `@RequirePermission`):
  - STAFF: `catalog:read, inventory:read, order:read, order:draft:write, order:fulfill`
  - MANAGER: STAFF + `audit:read, catalog:write, integration:retry, inventory:adjust, inventory:receive, order:cancel, order:confirm`
  - OWNER: MANAGER + `organization:reset-demo, organization:settings:read/write, team:read`
- **Tenant context**: every service wraps DB work in `TenantDatabase.withTenant({organizationId, actorId}, tx)` which sets Postgres GUCs `app.current_org_id` / `app.current_actor_id` transaction-locally (`database/tenant-database.ts:11-25`); RLS enforces row isolation. Org id always derived from the session, never from the client (README, `docs/architecture.md`).
- **Rate limiting**: in-memory token bucket, 60 req/60 s per path, public non-safe routes only, keyed by first `x-forwarded-for` IP (`auth/rate-limit.guard.ts:12-13,30-53`).
- **Demo auth**: `POST /auth/demo-login` requires `DEMO_MODE`, resolves the demo org membership by role + `DEMO_ORGANIZATION_SLUG`, auto-resets the org if the 6 h reset is due (`auth/auth.service.ts:53-74,103-153`). Demo passwords are `StockPilotDemo!` for all three demo accounts (`prisma/seed.ts:57`).

## 8. Existing third-party integrations

- **Cloudinary** (optional, `CLOUDINARY_URL` or explicit creds): product image upload to `stockpilot/{NODE_ENV}/products/{uuid}`, `overwrite:false`, 640×640 padded auto-format delivery URLs; orphan cleanup on failure (`catalog/product-image-storage.ts:188-309`, `catalog/product-image.service.ts:35-101`).
- **Mock storefront webhook** (built-in, not third-party): `POST /webhooks/mock-storefront/orders` with `x-delivery-id`, `x-organization-slug`, `x-storefront-signature` (HMAC-SHA256, `sha256=hex`, `timingSafeEqual`) — `integrations/storefront-signature.ts:6-23`, `integration.service.ts:40-82`; payload schema `MockStorefrontOrderSchema` (`integration.types.ts:3-22`).
- **pg-boss** (opt-in): queues `stockpilot.integration.retry` (backoff, 30 s delay, 5 attempts, 7 d retention, dead-letter), `stockpilot.integration.dead-letter`, `stockpilot.inventory.reconcile` (60 s delay, 5 attempts, 24 h); scheduled inventory reconciliation every 15 min (`*/15 * * * *`); starts only when `QUEUE_DATABASE_URL` set; `queueStatus()` = `ready | not_configured` (`jobs/job-runner.service.ts:13-16,36-89,110-112`).
- **Sentry** (optional, `SENTRY_DSN`): error capture with trace context, `tracesSampleRate: 0` (`observability/sentry-reporter.ts:9-30`).
- **UptimeRobot** (external demo): 5-min `GET /v1/health/live` monitor for Render Free keep-warm (README, `docs/deployment.md:61-85`).
- **Next.js image optimizer** allows `res.cloudinary.com` remote images (`apps/web/next.config.ts:10-17`).

## 9. Important business logic and invariants

- **Inventory projection**: `available = onHand - reserved`; every mutation goes through `projectInventory` which throws unless `onHand >= 0` and `0 <= reserved <= onHand`; balances are rows upserted + locked `FOR UPDATE` in **sorted product order** (deadlock avoidance) via `lockInventoryBalance` (`inventory/inventory-projection.ts:24-44`, `inventory/inventory-locks.ts:11-50`).
- **Receipts**: one transaction — validate warehouse/supplier/all products active, lock balances by sorted productId, project `onHandDelta`, write GoodsReceipt + lines + RECEIPT `StockMovement` + low-stock reconcile + audit (`inventory/receipt-command.service.ts:11-128`).
- **Adjustments**: `ADJUSTMENT_IN` adds / `ADJUSTMENT_OUT` subtracts with required `reason`; invariant violation → 409 (`inventory/adjustment-command.service.ts:15-112`).
- **Order state machine**: `DRAFT → {CANCELLED, CONFIRMED}`; `CONFIRMED → {CANCELLED, FULFILLED}`; `CANCELLED`/`FULFILLED` terminal; invalid transitions → conflict (`orders/order-state-machine.ts:3-19`).
- **Confirm**: row lock order `FOR UPDATE`, require `onHand - reserved >= line.quantity` per line, increment `reserved`; **Fulfill**: decrement `onHand` and `reserved`, write `SALE` movement; **Cancel-from-CONFIRMED**: release reservation only; each transition writes an `OrderTransition` row + audit (`orders/order-transition.service.ts:26-183`). All three are idempotency-keyed (`orders.service.ts:106-128`).
- **Draft orders**: created with warehouse/customer/active-product validation, subtotal computed server-side from current `salePrice` (never trusting client prices — no price in `SalesOrderInputSchema`), order number `SO-{Date.now()}-{uuid8}`, SKU/name/unit-price snapshots, `null→DRAFT` transition; draft lines replaceable only while status is DRAFT (`orders/order-draft.service.ts:10-117`, `orders.service.ts:56-104`).
- **Idempotency**: `executeIdempotent` — `pg_advisory_xact_lock(hashtextextended(orgId:scope:key))`, then `IdempotencyRecord` lookup; same payload fingerprint → replay stored response; different payload → 409; records expire after 24 h. Canonicalized JSON fingerprint (`idempotency/idempotency.ts:22-99`). Scopes used: `receipt:create`, `inventory:adjustment`, `order:transition:{status}`, `product-import:commit`, `integration:retry`, `organization:demo-reset`, `webhook:mock-storefront:order`.
- **Webhook dedup**: deliveries unique on `(organizationId, externalDeliveryId)`; creates Draft order `STORE-{externalOrderId}-{timestamp}`; reuses-or-creates customer by email; failed delivery → optional queue retry job (`integration-delivery.service.ts:85-167`, `storefront-order-draft.ts:7-107`).
- **CSV imports**: 2 MB / 5,000-row caps, required headers `sku,name,sale_price,reorder_point`, custom quoting-aware parser, preview flags duplicate/existing SKUs, commit is idempotent and requires PREVIEW status (`imports/product-csv-parser.ts:4-6,86-125`, `imports/product-import-commit.service.ts:9-42`).
- **Low-stock alerts**: opened/resolved within the same transaction as stock mutations; also reconciled by the optional scheduled job (`inventory/inventory-projection.ts:46-73`, `inventory/inventory-reconciliation.service.ts:43-85`).
- **Demo reset**: idempotent; only `is_demo` orgs; SQL function deletes operational rows → reseed deterministic fixture → audit → schedule next reset (6 h); auto-reset on demo login when due (`demo/demo-reset.service.ts:19-73`, `auth/auth.service.ts:103-153`). Fixture: 9 products (8 active), 5 customers, 3 suppliers, 8 balances, 1 receipt, 10 movements, 6 orders across statuses, 2 open alerts, 1 failed delivery, 1 preview import, 6 audit events; deterministic UUIDs via SHA-1 (`demo/demo-fixture.ts:20-32,192-200,231-724`).
- **Tenant isolation is DB-enforced**: runtime role `NOBYPASSRLS`, RLS FORCE on all tenant tables; verified in prod provisioning (`infra/postgres/provision-production.sql:87-124`).

## 10. Testing setup and what is currently covered

Commands: `pnpm test:unit` (contracts + api + web unit), `pnpm --filter @stockpilot/api test:integration`, `pnpm test:e2e` (Playwright), plus `format:check`, `lint`, `typecheck`, `typecheck:e2e`, `build` (`package.json:12-21`).

- **API unit** (vitest, `src/**/*.spec.ts`, ~44 tests): pure-domain only — rbac matrix, session-credentials (token/hash/CSRF derivation), permission guard, inventory projection, order state machine, CSV parser, storefront signature, idempotency fingerprint, product-image storage/cloudinary/service, environment, redaction, job-runner (with queue unset), health controller, prisma service, organization service, catalog mappers.
- **API integration** (vitest + Supertest against real Postgres, `apps/api/test/*.integration.spec.ts`, 26 tests): auth/session/CSRF/origin, catalog + tenant-scoped dashboard + CSV import preview/commit/errors/export, orders (price snapshots, role split, transitions, reservation, cancellation release, concurrent-confirm serialization → one 200 one 409), receipts/adjustments/alerts (idempotent replay, 409 on key reuse, over-adjust 409, Staff forbidden), integrations (HMAC, dedup, retry, bad signature 401), demo seed idempotency + owner reset + auto-reset, health/readiness (incl. degraded 503), tenant isolation/RLS + one-warehouse constraint + append-only ledger.
- **Web unit** (vitest, ~18 tests): homepage, SEO metadata contract, workspace shell (session/expired), demo-login card, operations-ui (focus/aria/status badges), workspace boundaries (role-gated actions), api-client (FormData/CSRF).
- **Contracts unit** (6 tests): enums, problem details, input normalization, receipt/adjustment/order line rules.
- **E2E** (Playwright, `tests/e2e/`, 12 tests, desktop Chrome + Pixel 5): accessibility (axe critical/serious), SEO/robots/sitemap/noindex/overflow/keyboard, duplicate-webhook (HMAC + dedup), manager receipt→draft→confirm + staff fulfill, staff sees no confirm buttons, owner reset, mobile receipt-to-fulfillment. `webServer: pnpm dev`, needs seeded Postgres.
- **CI** (`.github/workflows/ci.yml`): single `verify` job with Postgres 18 service — install → `init.sql` roles → generate → migrate → seed → format → lint → typecheck → typecheck:e2e → unit → integration → coverage → build → e2e.
- **Coverage gates**: per-file branch thresholds ≥80% only for `auth/rbac.ts`, `idempotency/idempotency.ts`, `inventory/inventory-projection.ts`, `orders/order-state-machine.ts` (`apps/api/vitest.config.ts:8-13`). Aggregate API unit coverage is low (18.7% lines) because DB-backed layers are exercised only by integration tests.
- **Known gaps**: no e2e for imports wizard, integrations/retry UI, adjustments UI, audit screen, overview chart, settings/team beyond reset, logout, session-expired (unit only), toasts; no web coverage numbers; no cross-browser e2e (Chromium only); no integration test for product-image upload, Sentry, or queue-worker/retry background jobs.

## 11. Deployment / demo setup

- **Topology**: Vercel (Next.js, same-origin `/api` proxy) → Render Free (NestJS API + migrations) → Neon (Postgres); optional Neon queue DB for pg-boss; UptimeRobot keep-warm (`README.md:178-189`, `docs/deployment.md`).
- **Local**: `cp .env.example .env && pnpm install && docker compose up -d postgres && pnpm db:generate && pnpm db:migrate && pnpm db:seed && pnpm dev` — web on :3000, API + Swagger on :4000 (`README.md:105-125`). `docker-compose.yml` runs api/web/postgres (Postgres 18-alpine) with `infra/postgres/init.sql` mounted as role bootstrap; API container runs migrate → seed → start.
- **`render.yaml`**: one Free Docker web service (`stockpilot-api`), Singapore, autoDeploy on commit, health check `/v1/health/ready`, `QUEUE_REQUIRED=false`, `CSRF_SECRET`/`WEBHOOK_SIGNING_SECRET` generated, `WEB_ORIGIN`/`DATABASE_URL` synced from dashboard.
- **`apps/web/vercel.json`**: builds contracts then web (`pnpm --filter @stockpilot/contracts build && pnpm --filter @stockpilot/web build`).
- **`deploy-render.yml`**: after CI succeeds on `main`, runs `prisma migrate deploy` + idempotent `db:seed` against Neon (URL normalized: strips `DATABASE_URL=` prefix, `-pooler.` → `.`), then optionally triggers `RENDER_DEPLOY_HOOK_URL`; otherwise Render auto-deploys `main`.
- **Demo data**: seeded idempotently on first deploy and after every 6-hour reset; demo org slug `stockpilot-demo` ("Harbor & Pine Wholesale"); three accounts (`owner@|manager@|staff@stockpilot-demo.stockpilot.test`, password `StockPilotDemo!`); one-click login from the landing page (`README.md:59-80`).
- **Free-tier notes**: Render Free sleeps after ~15 min (~1 min wake); UptimeRobot polls `/v1/health/live` (no DB); pg-boss left disabled (`QUEUE_REQUIRED=false`) to save Neon CU; manual integration retry works without the worker (`docs/deployment.md:61-85`, `docs/operations.md:47-52`).
- Live demo: `https://stock-pilot-web-five.vercel.app`; live API docs: `https://stockpilot-api-y1aw.onrender.com/docs` (`README.md:11-14`).

## 12. Existing mock / stub / incomplete functionality

- **Mock storefront webhook** is the only "integration" — a built-in mock endpoint for demo purposes; real marketplace integrations are out of scope (`integration.controller.ts:45-69`, README "Scope").
- **No mock data in the web app**: every screen calls the live API; unit tests stub `fetch`.
- **Overview "chart" is an HTML table** ("Accessible table summary"), not a chart (`features/overview/overview-workspace.tsx:251-296`).
- **"More" screen** is a bare link grid (`features/more/more-workspace.tsx`).
- **Single-line forms**: `OrderFormDrawer` and `ReceiptDrawer` register only `lines.0.*` fields even though schemas allow up to 200 lines (`features/orders/components/order-form-drawer.tsx:94-104`, `features/receipts/receipts-workspace.tsx:212-222`).
- **No server-side auth guard**: `/app` pages are unauthenticated HTML shells; auth is client-side session check → "expired" screen (`components/app/workspace-shell.tsx:32-65`). No `loading/error/not-found` boundary files; per-screen skeletons/error states hand-rolled.
- **Queue worker opt-in**: reconciliation and automatic retry jobs only run when `QUEUE_DATABASE_URL` is configured (disabled in all deployed profiles).
- **Scope-declared non-features** (README "Scope"): signup/invitations, payments, tax, debt, returns, purchase orders, partial receiving/fulfillment, variants, barcodes, lot/serial tracking, valuation, multiple warehouses, Redis, marketplace integrations.

## 13. Technical debt relevant to adding new features

- **Dashboard alias mismatch**: API returns `fourteenDayMovements`, deployed web build still references old `inboundOutbound14d` alias → chart can show empty state (`docs/test-report.md:72-79`).
- **Inconsistent idempotency usage**: order create, product/partner POST/PATCH do **not** send `Idempotency-Key`, while every other mutation does (`apps/web/lib/api-client.ts:61-95`; noted by web report §4).
- **Dead dependency**: `@tanstack/react-table` listed but never imported (custom `ResponsiveDataTable` used); `clearCsrfToken` only exercised by tests.
- **Tailwind v4 wired but effectively unused** — styling is hand-written CSS on design tokens; two parallel styling systems (`apps/web/app/globals.css:1-9`).
- **Weak coverage gates**: only 4 files have branch thresholds; DB-backed controllers/services/guards have 0% unit coverage (integration-only); no web coverage; no cross-browser e2e.
- **Free-tier demo constraints** baked into the architecture: `QUEUE_REQUIRED=false` default, no always-on worker, Render sleep/wake, Neon CU budget (`docs/deployment.md:61-85`).
- **Single-warehouse-per-org** is a hard DB constraint (`schema.prisma:118`, `20260804032400_init_auth_tenancy/migration.sql:88`) — any multi-warehouse feature must change schema + RLS-composite FKs.
- **Auth tables not RLS-enforced** — tenant scoping of users/memberships relies on application logic only (`20260804032400_init_auth_tenancy/migration.sql`, §7 of this doc).
- **In-memory rate limiter** is per-instance, not shared across replicas (`auth/rate-limit.guard.ts`).
- Prisma-generated code lives inside `apps/api/src/generated/` (gitignored; regenerated by `db:generate`).

## 14. Extension points relevant to future development

- **`packages/contracts`** is the single source of truth for input validation (Zod); both apps import it via `workspace:*`; adding a feature = add schemas here first.
- **RBAC matrix** (`auth/rbac.ts`) is a flat permission set per role; new capabilities are one permission string + decorator on the controller.
- **Idempotency wrapper** (`idempotency/idempotency.ts`) is generic — any state-changing endpoint can opt in with a scope string + `Idempotency-Key` header.
- **pg-boss job runner** (`jobs/job-runner.service.ts`) already defines queue naming, retry/backoff/dead-letter and cron scheduling conventions; adding background work = register a new queue + worker there.
- **`TenantDatabase.withTenant`** centralizes the tenant-context pattern every new service must follow to get RLS isolation (`database/tenant-database.ts:11-25`).
- **`ProblemDetailsFilter`** maps Zod/Prisma/HttpException errors globally — new error types slot into existing codes (`problem-details.filter.ts`).
- **Demo fixture** (`demo/demo-fixture.ts`) has a counted fixture (`DEMO_FIXTURE_COUNTS`) + deterministic IDs, wired into seed/reset/auto-reset; e2e/integration tests rely on it, so fixture changes must keep counts/assertions in sync (`apps/api/test/demo-seed.integration.spec.ts`, `tests/e2e/helpers.ts`).
- **Audit trail** is a generic JSONB before/after recorder (`audit/audit-record.ts`) — new mutations get audit by calling `recordAudit` inside their transaction.
- **Design tokens** in `design-system/stockpilot/MASTER.md` + `apps/web/app/styles/foundation.css` define the component vocabulary for new UI.
- **Web section registry**: `/app/[section]` whitelist (`apps/web/app/app/[section]/page.tsx:6-25`) + `WorkspaceSection` union + `workspace-content.tsx` switch + sidebar navigation array are the four places a new workspace screen must be registered.
