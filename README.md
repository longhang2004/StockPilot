# StockPilot

StockPilot is a multi-tenant inventory and B2B order operations SaaS built for
small wholesale teams. It is designed as a production-minded portfolio project:
clear product workflows, strict inventory invariants, tenant isolation, and a
public demo that can be understood quickly.

## Prerequisites

- Node.js 24 LTS
- pnpm 10.13.1
- Docker Desktop or another Docker Compose-compatible runtime

## Local development

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app runs at `http://localhost:3000`; the API and OpenAPI UI run at
`http://localhost:4000/v1/health/live` and `http://localhost:4000/docs`.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm typecheck:e2e
pnpm test:unit
pnpm --filter @stockpilot/api test:unit:coverage
pnpm --filter @stockpilot/api test:integration
pnpm test:e2e
pnpm build
```

The integration and browser gates need the PostgreSQL service from the local
Docker setup. Run `pnpm test:unit` for the fast no-database feedback loop.

## What is implemented

- A modular monolith split into `apps/web`, `apps/api`, and
  `packages/contracts`; PostgreSQL is the source of truth for tenant data.
- Catalog and partners with inactive lifecycle, CSV preview/commit/export, and
  row-level error downloads.
- An append-only stock ledger with atomic receipts, compensating adjustments,
  low-stock alert transitions, and `on_hand >= reserved >= 0` enforcement.
- Draft → confirmed → fulfilled/cancelled orders with price/SKU snapshots,
  deterministic balance locks, and concurrent confirmation protection.
- HMAC-signed storefront webhooks, delivery deduplication, failed-delivery
  retry, pg-boss dead-letter handling, RFC 9457 problem details, audit events,
  structured redacted logs, optional Sentry reporting, and Owner-only demo reset.
- Responsive `/app` routes for the operational overview, orders, inventory,
  products, partners, receipts, imports, integrations, audit, and settings.

Every state-changing receipt, adjustment, order transition, import commit,
integration retry, and demo reset requires an `Idempotency-Key`. The same key
and payload replay the original response; reusing a key with another payload
returns `409`.

## API surface

The versioned API is under `/v1`. Health checks are `/v1/health/live` and
`/v1/health/ready`; interactive OpenAPI is at `/docs` and the JSON document is
available at `/openapi.json`.

Important workflow routes include `/v1/products`, `/v1/customers`,
`/v1/suppliers`, `/v1/inventory/balances`, `/v1/inventory/movements`,
`/v1/receipts`, `/v1/orders`, `/v1/dashboard/overview`, `/v1/alerts`,
`/v1/product-imports/preview`, `/v1/webhooks/mock-storefront/orders`,
`/v1/integration-deliveries`, `/v1/organization/settings`, `/v1/team`, and
`/v1/organization/demo-reset`.

## Security boundary

The client never chooses its organization. The API derives tenant context from
the opaque session and sets it inside every transaction; tenant tables also use
forced PostgreSQL RLS. The runtime role has `NOBYPASSRLS`, and ledger/audit
tables revoke update/delete privileges. Passwords use Argon2id, session cookies
are HttpOnly/SameSite, browser writes require Origin + CSRF validation, and
webhook writes require a deployment signing secret.

## Deployment shape

For a portfolio deployment, run the Next.js web app on Vercel, the API/job
runner on Railway, and PostgreSQL on Neon. Set `DATABASE_URL` to the runtime
role, `MIGRATION_DATABASE_URL` to a migration role, and `QUEUE_DATABASE_URL` to
a dedicated pg-boss database role. The queue worker retries integration and
inventory reconciliation jobs with exponential backoff and routes exhausted
jobs to dead-letter queues. Run `prisma migrate deploy` during release, then
verify `/v1/health/ready` before serving traffic. See
[`docs/deployment.md`](docs/deployment.md) for the release runbook and
[`docs/walkthrough.md`](docs/walkthrough.md) for the portfolio demo script.

## Demo identities

The idempotent seed creates one shared organization, `Harbor & Pine Wholesale`,
with these accounts. All three use the password `StockPilotDemo!` when testing
the credential login flow; the public UI uses one-click role login.

| Role    | Email                                     |
| ------- | ----------------------------------------- |
| Owner   | `owner@stockpilot-demo.stockpilot.test`   |
| Manager | `manager@stockpilot-demo.stockpilot.test` |
| Staff   | `staff@stockpilot-demo.stockpilot.test`   |

The API stores only SHA-256 hashes of opaque session tokens. Browser sessions
use HttpOnly, SameSite cookies; state-changing requests require both a trusted
Origin and a per-session CSRF token. Tenant-owned queries run inside a
PostgreSQL transaction with `app.current_org_id`, and RLS provides the database
enforcement boundary.
