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

The repository currently has the API/web unit suites plus integration coverage
for the canonical seed/reset fixture and readiness policy. The core branch
threshold is enforced per file; the aggregate report is also emitted for
visibility, but untested infrastructure adapters are not allowed to hide the
domain threshold.

## Production-specific checks

- Readiness returns `200/ready` when the database is healthy and the queue is
  optional, and `503/degraded` when the database is down or a required queue is
  not configured.
- The idempotent demo seed creates 8 active products, 1 inactive product, 5
  customers, 3 suppliers, 8 balances, matching receipt/sale ledger totals, 2
  open alerts, six orders, one failed delivery, and one partial import.
- Owner and automatic reset both delete, reseed, audit, and schedule the next
  reset in one transaction; a second seed does not duplicate or overwrite
  operational data.
- The API binds to `0.0.0.0:$PORT`, enables Nest shutdown hooks, stops pg-boss,
  and disconnects Prisma on SIGTERM.

The live provider smoke run is available at the [Vercel production
origin](https://stock-pilot-web-five.vercel.app), with API checks at
[Render readiness](https://stockpilot-api-y1aw.onrender.com/v1/health/ready),
[Swagger UI](https://stockpilot-api-y1aw.onrender.com/docs), and
[OpenAPI JSON](https://stockpilot-api-y1aw.onrender.com/openapi.json). The
green `main` verification for the deployed documentation/runtime state is
[GitHub Actions run 30925609072](https://github.com/longhang2004/StockPilot/actions/runs/30925609072).
Render is running commit `f934e07`; readiness returns `200` with
`database:ok` and the expected free-profile `queue:not_configured` check. The
Vercel `/api/v1/health/ready` proxy also returns `200`. Render auto-deploys
`main`; the deployment workflow runs migration and idempotent seed, while an
optional deploy hook can be enabled for an explicit rollout.

## Live smoke snapshot · 4 August 2026

The following paths were exercised against the public deployment after the
canonical Owner reset. Each path completed without a partial mutation:

| Path                                                             | Result                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| Owner, Manager, and Staff one-click login                        | Pass                                     |
| Manager receipt apply and inventory movement update              | Pass                                     |
| Manager Draft → Confirmed; Staff Confirmed → Fulfilled           | Pass                                     |
| Confirmed cancellation, stock adjustment, and idempotency replay | Pass                                     |
| Signed duplicate storefront webhook                              | Pass; one Draft created                  |
| CSV preview with invalid row and valid-row commit                | Pass                                     |
| Failed integration manual retry                                  | Pass                                     |
| Owner reset and canonical reseed                                 | Pass; 9 products, 6 orders, 10 movements |
| Ledger/balance reconciliation after reset                        | Pass; zero violations and mismatches     |
| Secure session cookie, CSRF, and same-origin `/api` proxy        | Pass                                     |

The matching UI evidence is checked in under
[`docs/assets/`](assets/README.md): Overview desktop, Orders mobile, Inventory
desktop, and the mobile receipt drawer.

### Known presentation follow-up

The Overview API returns three rows in `fourteenDayMovements`, while the
current deployed web build still prefers the older `inboundOutbound14d` alias
when rendering the movement-window chart. As a result, the chart can show its
empty state even though the API and ledger data are correct. This is a
presentation-only follow-up; it does not affect receipt, reservation,
fulfillment, ledger, or balance invariants.

The free demo tier intentionally permits wake-up latency: Render Free may spin
down after inactivity, and Neon Free may suspend compute after five minutes.
UptimeRobot keeps the Render process warm but does not query Neon. The selected
profile leaves pg-boss disabled to preserve Neon Free compute hours; automatic
retry/reconciliation smoke requires the opt-in queue profile and is not part of
the always-on free demo.

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
