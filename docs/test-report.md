# StockPilot verification report

This report separates four kinds of evidence so a reviewer can trust each
claim:

1. **Commands the repository supports** — scripts defined in `package.json`.
2. **Checks executed in this working tree** — reproduced locally during the
   hardening pass (14 August 2026), with real results below.
3. **Historical CI evidence** — old runs, labeled with the commit they
   covered. A green run is never proof for a later commit.
4. **Current live deployment evidence** — what the public demo endpoints
   actually returned when probed, and what that does (and does not) prove.

## Verification gates (commands the repository supports)

| Gate                   | Command                                            | Purpose                                                                                                  |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Formatting             | `pnpm format:check`                                | Prettier consistency across the workspace                                                                |
| Static analysis        | `pnpm lint` and `pnpm typecheck`                   | ESLint and strict TypeScript                                                                             |
| Unit/contract          | `pnpm test:unit`                                   | Domain rules, permissions, contracts, and web shell/UI tests                                             |
| Branch gate            | `pnpm --filter @stockpilot/api test:unit:coverage` | 80% branch coverage for core RBAC, idempotency, inventory projection, and order state-machine modules    |
| PostgreSQL integration | `pnpm --filter @stockpilot/api test:integration`   | RLS, sessions/CSRF, atomic inventory, concurrency, imports, duplicate webhooks, OpenAPI contract surface |
| Production build       | `pnpm build`                                       | Contracts, NestJS API, and Next.js production bundles (standalone output)                                |
| Browser acceptance     | `pnpm test:e2e`                                    | Desktop/mobile workflows and axe accessibility smoke checks                                              |
| Containers             | `docker build -f apps/api/Dockerfile .` etc.       | Both production images build and run as the non-root `node` user (CI job `docker-build`)                 |
| Supply chain           | `pnpm audit --audit-level high`                    | Hard CI gate; Dependabot opens weekly grouped update PRs; CodeQL scans on PR/push/schedule               |
| Performance smoke      | `pnpm perf:smoke`                                  | Developer-run load probe; see [docs/performance.md](performance.md)                                      |

Integration and browser tests require a running PostgreSQL database seeded
with the demo organization:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm --filter @stockpilot/api exec prisma migrate deploy
pnpm db:seed
pnpm test:e2e
```

The E2E web server supervisor (`scripts/e2e-server.mjs`) owns the API and
web processes: it refuses to run when ports 3000/4000 are occupied, starts
the API first, waits for `/v1/health/ready` (the DB-backed readiness probe),
then starts the web app, so tests never race API startup or database
connectivity. Playwright never reuses stale local servers
(`reuseExistingServer: false`). E2E runs with a single worker: the suite
shares one seeded demo database and mutates it (receipts, orders, and the
Owner reset), so parallel workers would race on shared fixture state. A
CI-only single retry covers `next dev` connection drops during on-demand
recompilation (absent in production `next start`).

## Checks executed in this working tree (14 August 2026)

All commands below were run locally against commit `8daefed` + the hardening
changes described in the repository's CI and docs, with Node 24.19.0, pnpm
10.13.1, and PostgreSQL 18 in Docker. The database was dropped, migrated,
and seeded before the browser suite, mirroring CI.

**Local vs GitHub-hosted CI:** the table below is local evidence. The same
commit set was additionally verified by GitHub-hosted CI — the `verify` and
`docker-build` jobs of run
[31817920438](https://github.com/longhang2004/StockPilot/actions/runs/31817920438)
(commit `0a2e535`, all gates incl. 28/28 E2E on Linux, `pnpm audit`
clean, archive self-test, and both container builds) — plus CodeQL
(success) and the Render deploy workflow (success). Local and CI results
agree; where they cannot both run (platform-specific behavior), the
difference is stated explicitly.

| Gate                                               | Result                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm format:check`                                | Pass (0 files failing)                                                              |
| `pnpm lint`                                        | Pass                                                                                |
| `pnpm typecheck`                                   | Pass (contracts, api, web)                                                          |
| `pnpm typecheck:e2e`                               | Pass                                                                                |
| `pnpm test:unit`                                   | Pass (contracts 6 + api 87 + web 30)                                                |
| `pnpm --filter @stockpilot/api test:unit`          | Pass (rate-limiter, CIDR, client-address, and error-status mapping tests added)     |
| `pnpm --filter @stockpilot/api test:integration`   | Pass (14 files, 67 tests, incl. OpenAPI contract suite)                             |
| `pnpm --filter @stockpilot/api test:unit:coverage` | Pass (branch threshold enforced per file)                                           |
| `pnpm build`                                       | Pass (contracts, NestJS, Next standalone)                                           |
| `pnpm test:e2e`                                    | Pass — 28/28 on the final corrected code, exit 0                                    |
| `docker build apps/api/Dockerfile`                 | Pass (see note below)                                                               |
| `docker build apps/web/Dockerfile`                 | Pass (see note below)                                                               |
| `pnpm audit --audit-level high`                    | Pass (0 known vulnerabilities; two transitive advisories closed via pnpm overrides) |

> **Container evidence (local vs GitHub-hosted CI):** locally, both
> production images were built from the final change set
> (`docker build -f apps/api/Dockerfile .` and
> `docker build -f apps/web/Dockerfile --build-arg API_INTERNAL_URL=... .`)
> and inspected (`Config.User = node` for both); the API image was also
> run in-container (health + corrected `/openapi.json` verified). The same
> final commit set was built again by the GitHub-hosted CI `docker-build`
> job (run
> [31817920438](https://github.com/longhang2004/StockPilot/actions/runs/31817920438),
> commit `0a2e535`), which also asserts both images run as `node`.

## Correction pass (14 August 2026, second review)

An independent review of the first hardening pass found correctness and
evidence-integrity issues, all fixed and re-verified:

- **X-Forwarded-For trust algorithm:** the resolver walked the chain LEFT TO
  RIGHT; the correct semantics for a trusted-proxy chain are RIGHT TO LEFT
  from the nearest hop (each proxy appends the previous hop), stopping at
  the first untrusted hop. Fixed in `src/auth/client-address.ts` with 11
  unit tests (no-trust default, untrusted socket, one/multiple proxies,
  attacker-prepended spoofs, IPv4/IPv6/mapped forms, malformed entries).
- **OpenAPI idempotency claims:** `POST /v1/orders` and
  `PATCH /v1/orders/{id}` advertised a required `Idempotency-Key` that
  runtime never consumes. Removed; the integration suite now asserts
  create/update do NOT require it while transitions, receipts,
  adjustments, import commit, integration retry, and demo reset DO.
- **OpenAPI source-of-truth drift:** API-local schemas (login, signup,
  demo-login, switch-workspace, import preview, product/partner update,
  list queries, identifiers, idempotency keys) were duplicated between
  controllers and `openapi/schemas.ts`; the update schemas had drifted
  (missing the empty-payload rejection). All now live in domain schema
  modules (`src/{auth,catalog,orders,inventory,imports}/*-schemas.ts`,
  `src/validation/common-schemas.ts`) imported by BOTH the controllers and
  the OpenAPI projection; `minProperties: 1` expresses the runtime
  refine structurally (documented in code).
- **Inventory response shapes:** `GET /v1/inventory/balances` advertised
  `ProductList`; accurate `InventoryBalance(List)`, `StockMovementList`,
  and `LowStockAlert(List)` schemas now mirror the actual serializers.
- **Authentication in OpenAPI:** one stable `sessionCookie` scheme
  (cookie name from environment); protected operations declare it and
  browser writes document `X-CSRF-Token`; public routes (login, signup,
  demo-login, webhooks) stay public. Reusable `SessionAuth` /
  `SessionAuthWrite` decorators.
- **Request-log status mapping:** `ZodError`/Prisma errors were logged as
  500 while responding 400/404/409. One shared `errorStatusCode` mapping
  (`src/problem-status.ts`) now drives both the problem-details filter and
  the logging interceptor, with 7 unit tests.
- **Perf smoke defaults:** default runs benchmark authenticated reads only;
  `demo-login` is opt-in (`--include-writes`, capped at 40 requests to stay
  under the 60/min limiter), and `--rate-limit-check` explicitly verifies
  429 enforcement (59 allowed / 41 limited on the sample run) without
  treating expected 429s as failures.
- **E2E process ownership:** `reuseExistingServer: false`; the supervisor
  checks BOTH ports up front (verified: fails with an actionable message
  when :4000 is occupied), gates on `/v1/health/ready`, honors `PORT`, and
  pins the web child to :3000. The suite ran 28/28 on `PORT=4100` because
  a foreign container on this host already used :4000.
- **Archive safety:** `scripts/compress.py` now excludes `.env` and
  `.env.*` while keeping `.env.example` and never archiving existing
  archives; `--self-test` (wired into CI) plus a real archive generation
  verified the rules.

## E2E regressions found and fixed (this pass)

The E2E suite was red in CI (run
[31250181153](https://github.com/longhang2004/StockPilot/actions/runs/31250181153)
for commit `8daefed`) and locally. Root causes, each fixed at the source:

1. **Loader contrast regression (deterministic):** the workspace loading
   mark animated `opacity` to 0.5, dropping text contrast below WCAG AA
   (4.16:1) mid-pulse. The axe smoke (which includes `serious` violations)
   caught it on the mobile project. Fixed with a scale-only pulse
   (`workflows.css`), keeping colors at full opacity.
2. **API startup race:** the Playwright web server only waited for the web
   app on `:3000`; `pnpm dev` boots API and web in parallel, so tests that
   hit `/api` in the first seconds saw 500s ("We could not start the demo").
   Fixed with `scripts/e2e-server.mjs`, which gates test start on API
   readiness.
3. **Parallel-worker interference:** the config ran multiple workers locally
   (`workers: undefined`), racing tests that share and mutate the seeded
   demo database (e.g. the Owner reset mid-receipt). Fixed by pinning
   `workers: 1` with the rationale documented in `playwright.config.ts`.
4. **Residual dev-mode flake:** `next dev` occasionally drops a connection
   while recompiling a route on demand (reproduced as
   `ERR_CONNECTION_REFUSED` / `socket hang up` on `/api` rewrites and the
   `/icon` image route; absent in production `next start`). Covered by a
   single CI-only retry, documented in the config.
5. **Misleading error logs (observability):** the request-logging
   interceptor logged the controller's declared `@HttpCode` (e.g. 201)
   instead of the real error status (e.g. 409) because `finalize` runs
   before the exception filter sets it. Fixed in
   `request-logging.interceptor.ts` by deriving status from the exception.

## Historical CI evidence

- `f934e07` — CI run
  [30925609072](https://github.com/longhang2004/StockPilot/actions/runs/30925609072)
  green (historical; covers the commit at the time of the live smoke below).
- `bf8eaff` — CI run
  [30978846071](https://github.com/longhang2004/StockPilot/actions/runs/30978846071)
  green (historical).
- `8daefed` (the pre-hardening tip of `main`) — CI run
  [31250181153](https://github.com/longhang2004/StockPilot/actions/runs/31250181153)
  **failed at `pnpm test:e2e`** (historical; this report documents the
  diagnosis above).

These runs are evidence for their own commits only.

## Current live deployment evidence (probed 14 August 2026)

The public demo endpoints responded as follows:

| Endpoint                                                   | Result                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `https://stockpilot-api-y1aw.onrender.com/v1/health/ready` | `200` — `{"checks":{"database":"ok","queue":"not_configured"},"status":"ready"}` |
| `https://stockpilot-api-y1aw.onrender.com/docs`            | `200`                                                                            |
| `https://stockpilot-api-y1aw.onrender.com/openapi.json`    | `200` (serves the pre-hardening document)                                        |
| `https://stock-pilot-web-five.vercel.app`                  | `200` (homepage)                                                                 |

What this proves: the free-tier services are alive and the API reaches its
database. What it does **not** prove: the live deployment runs the working
tree's changes. Render auto-deploys `main`; the hardening changes in this
pass are not yet merged/deployed, so the live OpenAPI document still shows
the previous minimal schema and the live API does not yet serve the
hardened rate limiter or OpenAPI contracts. A live smoke snapshot from
4 August 2026 (commit `f934e07`) is preserved below as historical evidence.

### Historical live smoke snapshot · 4 August 2026 (commit `f934e07`)

The following paths were exercised against the public deployment after the
canonical Owner reset:

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

## Production-specific checks

- Readiness returns `200/ready` when the database is healthy and the queue is
  optional, and `503/degraded` when the database is down or a required queue
  is not configured (integration-tested).
- The idempotent demo seed creates 8 active products, 1 inactive product, 5
  customers, 3 suppliers, 8 balances, matching receipt/sale ledger totals, 2
  open alerts, six orders, one failed delivery, and one partial import
  (integration-tested).
- Owner and automatic reset both delete, reseed, audit, and schedule the
  next reset in one transaction; a second seed does not duplicate or
  overwrite operational data (integration-tested).
- The API binds to `0.0.0.0:$PORT`, enables Nest shutdown hooks, stops
  pg-boss, and disconnects Prisma on SIGTERM.

## Acceptance matrix

| Invariant                                          | Automated coverage                              |
| -------------------------------------------------- | ----------------------------------------------- |
| Tenant context comes from the session              | PostgreSQL integration + API auth tests         |
| `on_hand >= reserved >= 0`                         | Inventory integration and projection unit tests |
| Ledger is append-only                              | Migration grants + inventory integration        |
| Confirm is concurrency-safe                        | Concurrent order integration test               |
| State transitions are terminal and role-separated  | State-machine unit + E2E                        |
| Webhook deliveries are idempotent                  | Integration + duplicate-webhook E2E             |
| Valid CSV rows commit despite invalid rows         | Product import integration + UI wizard          |
| Low-stock alerts do not duplicate and recover      | Reconciliation unit + integration               |
| Owner-only reset/settings/team views               | RBAC + Owner E2E                                |
| Core screens are keyboard/contrast safe            | axe smoke tests + semantic UI primitives        |
| OpenAPI exposes contracts, params, and idempotency | OpenAPI contract integration suite              |
| Public-write rate limiting is bounded and evicts   | Rate-limiter + CIDR unit tests                  |
