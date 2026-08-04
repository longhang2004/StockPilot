# StockPilot verification report

The CI pipeline is intentionally layered so a reviewer can distinguish fast
feedback from database-backed acceptance coverage.

| Gate                   | Command                                            | Purpose                                                                                                   |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Formatting             | `pnpm format:check`                                | Prettier consistency across the workspace                                                                 |
| Static analysis        | `pnpm lint` and `pnpm typecheck`                   | ESLint and strict TypeScript                                                                              |
| Unit/contract          | `pnpm test:unit`                                   | Domain rules, permissions, contracts, and web shell/UI tests                                              |
| Branch gate            | `pnpm --filter @stockpilot/api test:unit:coverage` | 80% branch coverage for the core RBAC, idempotency, inventory projection, and order state-machine modules |
| PostgreSQL integration | `pnpm --filter @stockpilot/api test:integration`   | RLS, sessions/CSRF, atomic inventory, concurrency, imports, and duplicate webhooks                        |
| Production build       | `pnpm build`                                       | Contracts, NestJS API, and Next.js production bundles                                                     |
| Browser acceptance     | `pnpm test:e2e`                                    | Desktop/mobile workflows and axe accessibility smoke checks                                               |

The repository currently has 24 API unit tests and 7 web unit tests. The core
branch threshold is enforced per file; the aggregate report is also emitted
for visibility, but untested infrastructure adapters are not allowed to hide
the domain threshold.

## Expected local prerequisites

Integration and browser tests require a running PostgreSQL database seeded with
the demo organization. The simplest setup is:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm --filter @stockpilot/api exec prisma migrate deploy
pnpm db:seed
pnpm test:e2e
```

CI provisions PostgreSQL as a service, runs the init SQL and migrations, seeds
the data, then executes every gate in order. If Docker is unavailable locally,
unit, typecheck, lint, and build results remain valid; integration/E2E must be
rerun once the database is reachable.

## Acceptance matrix

| Invariant                                         | Automated coverage                              |
| ------------------------------------------------- | ----------------------------------------------- |
| Tenant context comes from the session             | PostgreSQL integration + API auth tests         |
| `on_hand >= reserved >= 0`                        | Inventory integration and projection unit tests |
| Ledger is append-only                             | Migration grants + inventory integration        |
| Confirm is concurrency-safe                       | Concurrent order integration test               |
| State transitions are terminal and role-separated | State-machine unit + E2E                        |
| Webhook deliveries are idempotent                 | Integration + duplicate-webhook E2E             |
| Valid CSV rows commit despite invalid rows        | Product import integration + UI wizard          |
| Low-stock alerts do not duplicate and recover     | Reconciliation unit + integration               |
| Owner-only reset/settings/team views              | RBAC + Owner E2E                                |
| Core screens are keyboard/contrast safe           | axe smoke tests + semantic UI primitives        |
