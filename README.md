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
pnpm test
pnpm build
```

The full architecture, data model, security trade-offs, demo accounts, and
deployment guide will be expanded as the corresponding implementation phases
land.

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
