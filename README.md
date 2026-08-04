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
