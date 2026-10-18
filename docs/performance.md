# StockPilot performance smoke harness

A small, dependency-free load probe for representative API workloads. It
exists to demonstrate how this codebase is load-tested and how the numbers
should be read — not to claim internet-scale performance.

## Environment prerequisites

- A running StockPilot API (`pnpm dev` or the production container) with:
  - `DEMO_MODE=true` and the seeded demo organization
    (`pnpm db:seed` after `prisma migrate deploy`);
  - a reachable PostgreSQL database (the demo fixture has 8 products, 6
    orders, and 5 customers, so the read workloads query real rows).
- Node.js 24 and pnpm 10.13.1 (the repository's pinned versions).
- No other load generator running against the same API.

## Command

```bash
API_URL=http://localhost:4000 pnpm perf:smoke
# options
pnpm perf:smoke -- --concurrency 20 --requests 500
pnpm perf:smoke -- --include-writes   # opt-in public-write workload
pnpm perf:smoke -- --rate-limit-check # verify 429 enforcement
pnpm perf:smoke -- --json             # machine-readable output
pnpm perf:smoke -- --help
```

Defaults: `API_URL=http://localhost:4000`, `--concurrency 10`,
`--requests 200` (per workload).

## Workloads

| Workload        | Request                             | Notes                                                                |
| --------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `orders-list`   | `GET /v1/orders` (authenticated)    | Default; read-heavy listing + pagination                             |
| `balances-list` | `GET /v1/inventory/balances` (auth) | Default; operational read over balances                              |
| `demo-login`    | `POST /v1/auth/demo-login`          | Opt-in (`--include-writes`); public write, capped at 40 requests/run |

The harness logs in once as the seeded Manager and replays the session
cookie for the read workloads, so they exercise the real auth/session path.
The write workload is **not** part of the default run: `demo-login` is a
public write limited to 60 requests per minute per client by the auth-tier
rate limiter, and load-testing it by default would collide with that limit
by design. When opted in, the workload is capped at 40 requests so latency
numbers are never polluted by intentional 429s.

### Rate-limit check mode

`--rate-limit-check` runs only `demo-login` (default 100 requests, override
with `--requests`) and treats `429` as the expected outcome once the
threshold is crossed — **not** as a performance failure. It exits non-zero
only when no 429 appears (the limiter is not enforcing) or an unexpected
status shows up. This is the correct way to observe rate-limiting behavior;
the performance workloads above deliberately stay out of the limiter's way.

## Metrics reported (per workload)

- **requests**: completed requests (errors included).
- **req/s**: throughput.
- **p50 / p90 / p95 / p99 (ms)**: latency percentiles over the completed
  requests, computed from client-observed wall time (includes network
  round-trip, API processing, and database time).
- **errors**: non-2xx responses and network failures, with the first error
  printed. The command exits non-zero when any workload saw errors, so the
  probe can be used as a smoke gate (distinguishing correctness from
  performance).

## Interpretation

- Compare workloads against each other and against a **baseline run on the
  same machine**, not against other people's numbers. Latency percentiles
  from a local laptop are not deployment metrics.
- A high p99 relative to p50 usually means connection/event-loop contention
  or database connection saturation — check the pg pool and the API's
  structured request logs (`durationMs` per request).
- Any error during a performance run invalidates the latency numbers for
  that workload: fix the error first, then re-measure. (Expected 429s in
  `--rate-limit-check` mode are the exception by design.)
- The API is a single NestJS process; these workloads are single-instance
  by design.

## Sample run (local, 14 August 2026)

Measured with the production API container (`stockpilot-api` image built
from this tree, Node 24, PostgreSQL 18 on the same machine via Docker).
Exact command:

```bash
API_URL=http://localhost:4003 pnpm perf:smoke -- --requests 50
```

(default workloads only: `orders-list` and `balances-list`, concurrency 10):

| Workload        | req/s | p50 ms | p90 ms | p95 ms | p99 ms | Errors |
| --------------- | ----- | ------ | ------ | ------ | ------ | ------ |
| `orders-list`   | 346.0 | 16.3   | 62.6   | 82.2   | 85.8   | 0      |
| `balances-list` | 390.0 | 24.2   | 29.6   | 32.2   | 33.0   | 0      |

The same session also ran `--rate-limit-check` (100 demo-login requests:
59 allowed, 41 returned 429 as designed) and `--include-writes`
(demo-login capped at 40: 795.2 req/s, p50 11.2 ms, 0 errors). These
numbers describe this laptop, this database, this day — nothing else. Use
them only as a local baseline for change detection.

## Guarded local and staging protocol

The harness validates `API_URL` before it sends requests. Loopback targets are
allowed; any non-loopback target requires `--allow-staging`,
`PERF_TARGET=staging`, an exact `PERF_TARGET_HOST` match, and the host-specific
acknowledgement `PERF_TARGET_ACKNOWLEDGEMENT=I_CONFIRM_<host>_IS_DISPOSABLE_STAGING`.
Remote mode disables demo-login writes and rate-limit checks. Do not use the
public demo as a performance target.

For an isolated local production API image and a 100k movement fixture, run
`pnpm perf:local` (or pass a smaller row count, up to 100000). It allocates a
unique Compose project and database volume, binds only the configured loopback
API port (default 4300), seeds only that project's demo tenant, performs an
authenticated read-only run, captures an app-role `EXPLAIN (ANALYZE, BUFFERS,
SETTINGS)`, and rehearses a logical database restore into a second database in
the same disposable container. It refuses reserved/occupied ports and removes
only the project it created. Compose receives `/dev/null` as its env file so
the repository `.env` is not imported. The synthetic fixture adjusts the local
demo balance and ledger together, and the database volume is discarded after
the run.

The local protocol performs three measured runs. Each run uses 20 sequential
warmup requests for each selected read route, then 100 concurrent samples per
route at concurrency 10. It records the observed API revision, request counts,
p50/p90/p95/p99, throughput and errors. The
performance run writes JSON, query-plan output, backup, and Compose logs below
the ignored `test-results-performance/` directory. Preserve that output only
when it contains no private data; the local fixture is synthetic. The logical
restore checks the movement count but is not evidence of a managed Neon PITR,
production rollback, or deployment compatibility rehearsal.

For a staging measurement, start with a disposable staging tenant/database and
obtain service-owner approval for the target host. Keep all operations
read-only; capture the staging revision, dataset scale, runtime/instance
details, warmup and repeat counts, errors, latency percentiles, and the exact
commands. Run the app-role query plan separately with the correct tenant
context. Contention and provider failover experiments require a disposable
environment and are not part of routine demo measurements.

No new measurements are claimed here until the isolated production image and
browser suites have passed the integrated source gate. The sample below is the
older historical laptop baseline only.

## Caveats

- **Not a benchmark.** The harness supports optional sequential warmup, but
  default runs have no warmup or repeated-run statistics and do not emulate
  internet traffic. Treat it as a reproducible smoke probe, not a capacity
  claim.
- **Environment-dependent.** `next dev`/`nest start --watch` add
  compile-time overhead to first requests; run against the production build
  (`pnpm build` + `pnpm --filter @stockpilot/api start`) for steadier
  numbers.
- **Demo-login writes.** Each `demo-login` request creates a session row.
  The six-hour demo reset clears sessions; do not point the harness at a
  production tenant.
- **Rate limiting.** The auth-tier limiter caps `/v1/auth/demo-login` at
  60 requests per minute per client address (in-memory, per process). The
  default run never touches it; `--include-writes` caps the workload at 40;
  `--rate-limit-check` is the mode that deliberately crosses it.

## Scaling notes

The harness itself needs no scaling. If this project ever needs real load
testing (multi-instance, soak, spike), the natural next step is k6 or
Artillery against a staging deployment; the API's structured logs and
readiness endpoint already provide the observability hooks those tools
consume.
