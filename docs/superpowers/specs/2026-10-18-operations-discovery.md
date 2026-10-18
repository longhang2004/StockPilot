# Operations and evidence discovery

Date: 2026-10-18. Repository revision inspected: `312eee9ed383fb293273c989b8a00a4ed43903b6`.
Scope: operations/evidence lane for the interview-readiness plan. This is a discovery note only; implementation and provider state were not changed.

## Findings

The repository already has useful release controls and operational documentation, but the evidence stops short of a durable browser run against the shipped production images. GitHub Actions builds both images and checks that their configured user is `node`; its Playwright run uses `scripts/e2e-server.mjs`, which starts API and web development servers. A one-off production-container browser run was reported as 30/30 passing on 2026-10-17, but its temporary Playwright profile was removed. Preserve that as historical local evidence, not a repeatable CI gate.

The current remote evidence in `docs/interview-readiness-review-2026-10-18.md` is specific to this SHA: CI run `39060081766` and CodeQL run `39060081879` succeeded; the latest E2E had 29 tests pass and one accessibility login test pass on retry after a five-second URL wait timed out. The Render workflow run `39060556805` stopped at its required-secret check because `RENDER_DEPLOY_HOOK_URL` was absent. It therefore did not migrate, seed, or request a Render rollout. Public API readiness was observed at revision `195e8535c9420213b56d7e84733a1eaa56e912cc`, database `ok`, and queue `not_configured`; that is an API revision observation, not confirmation of the web deployment revision.

The deploy workflow does the production migration, idempotent seed, and Render hook POST in that order. It has no step that polls Render until the service is ready or checks that the reported `revision` equals `RENDER_COMMIT_SHA`. The health endpoint already exposes the necessary data: `/v1/health/live` for process liveness and `/v1/health/ready` for a database-backed readiness probe; both include the Render commit revision. The normal free profile intentionally omits the queue, so `queue:not_configured` with ready status is expected while `QUEUE_REQUIRED=false`.

The performance harness is a smoke probe, not a load-test system. Its documented baseline is 50 requests per read workload against a local production API container and same-machine PostgreSQL, with a small demo fixture. Its default workloads authenticate once and measure `GET /v1/orders` and `GET /v1/inventory/balances`; write mode creates demo sessions and rate-limit mode intentionally generates 429s. This is adequate for reproducible local change detection. It cannot establish staging capacity, large-tenant query behavior, lock contention, or production latency.

Database rollback and point-in-time restore are documented procedures, not rehearsals. A credible rehearsal needs an isolated disposable database/service or provider clone, a named safe migration/deployment scenario, recorded invariants, and cleanup. It must not be attempted against the live demo as an unannounced exercise.

## Current files and responsibility

| File                                                          | Existing behavior                                                                                                                                                                                      | Planned change or evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                                    | `verify` runs migrations, tests, build, and the Playwright suite; `docker-build` builds API/web images and asserts `Config.User=node`. Playwright artifacts upload only when the job fails.            | Add a production-image browser acceptance job or profile using Compose, with an isolated seeded PostgreSQL database, and run the existing browser suite against the built images. Retain report, traces, screenshots, and `test-results/e2e-server.log` for flaky/retried outcomes as well as hard failures. Keep the dev-server job because it catches development-mode regressions.          |
| `playwright.config.ts`                                        | `webServer` always invokes the dev supervisor; browser projects are desktop Chromium and Pixel 5; one retry is enabled in CI; trace is retained on failure.                                            | Add a small explicit external-server mode that suppresses `webServer` when CI has already started Compose, and obtain the base URL from a validated environment variable. Preserve current default behavior. Do not mask flaky results by increasing the retry count.                                                                                                                          |
| `scripts/e2e-server.mjs`                                      | Owns local API and web dev processes, waits for DB-backed API readiness, warms metadata routes, and tees logs.                                                                                         | No production behavior belongs here. Keep its server log available to the existing dev E2E job.                                                                                                                                                                                                                                                                                                |
| `docker-compose.yml`                                          | Defines PostgreSQL, one-shot migration and seed, production API, and production web image; maps ports 5432/4000/3000. API uses `QUEUE_REQUIRED=false`.                                                 | Reuse as the acceptance topology where possible. Make readiness/origin/ports explicit for CI only if required; keep all credentials synthetic. Compose shutdown and named-volume cleanup should be part of the CI job.                                                                                                                                                                         |
| `apps/api/Dockerfile`, `apps/web/Dockerfile`                  | Multi-stage production images run as non-root `node`; web rewrite target is baked at build time.                                                                                                       | Build both images with the same arguments and code under test, then execute the browser suite through the web image and API image. The web build argument must target the Compose API service.                                                                                                                                                                                                 |
| `.github/workflows/deploy-render.yml`                         | Requires migration and Render hook secrets before checkout; applies migrations, seeds, then posts the hook with the workflow head SHA. Ends after the POST.                                            | After the POST, poll the public API readiness URL under a bounded timeout with backoff. On 200, require `status=ready`, `checks.database=ok`, and `revision == RENDER_COMMIT_SHA`; treat `queue:not_configured` as valid for this profile. Print only status/revision/check names, never secret URLs or connection strings. Fail visibly on timeout, degraded readiness, or revision mismatch. |
| `apps/api/src/health/health.controller.ts`                    | Readiness probes the database and applies queue-required policy; both health bodies include `revision`.                                                                                                | Existing API is sufficient for the API release gate. It does not expose the web revision; verify the Vercel deployment SHA through Vercel deployment details or add a separately sourced web build identifier if a machine-readable web check is required.                                                                                                                                     |
| `render.yaml`                                                 | Render auto-deploy is off and its platform health check is `/v1/health/live`; one Free API instance is selected.                                                                                       | Keep platform health check cheap. The workflow post-deploy gate can use `/v1/health/ready` so it checks the database and release SHA.                                                                                                                                                                                                                                                          |
| `docs/deployment.md`                                          | Documents release order and rollback/restore commands, plus smoke paths; states that the hook workflow gates migration and seed before rollout.                                                        | Add the exact bounded readiness/revision gate and a run record template. Separate app rollback (redeploy last known-good app commit) from database restore (point-in-time clone/branch and role/ledger verification). Mark rehearsal results as pending until exercised against disposable infrastructure.                                                                                     |
| `docs/operations.md`                                          | Describes liveness/readiness, queue-optional semantics, logs, demo reset, and recovery.                                                                                                                | Add an operator-facing release verification checklist that matches the implemented deploy workflow and records SHA, readiness result, and API/web deployment revisions.                                                                                                                                                                                                                        |
| `docs/performance.md`, `scripts/perf-smoke.mjs`               | Smoke workload and August 2026 laptop baseline; reports requests/s, latency percentiles and errors.                                                                                                    | Keep historical local baseline labeled as local. Add a staging protocol and a separate results record for a larger fixture; do not relabel the current smoke harness as a capacity benchmark.                                                                                                                                                                                                  |
| `STOCKPILOT_TECHNICAL_INTERVIEW_GUIDE.md` (untracked/private) | Contains claims that exceed observed evidence, including automatic rollback on client disconnect, readiness removal from the load balancer, O(1) B-tree lookup, and proven million-row scale behavior. | Correct claims at lines 726, 737, 743, 759, 780, and 794-801 using `docs/interview-readiness-review-2026-10-18.md` as the source of findings. Replace claims of measured scale with a concrete proposal and state the current local/staging evidence boundary. The guide is untracked and must remain a user-owned private document; review and edit only as a deliberate follow-up.           |
| `docs/architecture.md`                                        | Lines 25-26 describe Render auto-deploy on `main` and an optional hook.                                                                                                                                | Correct this stale deployment description: `render.yaml` disables auto-deploy and the workflow requires both secrets before migration/seed/hook.                                                                                                                                                                                                                                               |

## Production-image acceptance profile

The least disruptive durable profile is a new job in `.github/workflows/ci.yml` that runs after the repository has built the same production images. A job with its own Docker Compose topology can build and start PostgreSQL, migration/seed, API image, and web image; then the job runner installs the locked workspace dependencies and Chromium and runs `pnpm test:e2e` with the explicit external-server mode. Since tests mutate a shared seeded demo tenant and the Owner reset wipes/reseeds it, preserve `workers: 1`. Do not run this concurrently against a shared database. Use job-local services and synthetic credentials only.

Candidate command shape after the config mode exists:

```bash
docker compose -f docker-compose.yml up --build --detach --wait
E2E_EXTERNAL_SERVER=1 E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
docker compose -f docker-compose.yml down --volumes --remove-orphans
```

The current Playwright config does not support `E2E_EXTERNAL_SERVER` or `E2E_BASE_URL`; these are proposed names, not existing settings. A safer workflow should run Compose teardown in an `if: always()` step. Give the acceptance job its own Compose project name to avoid collisions. The Compose stack's Postgres port may conflict with a GitHub service container if both are used in the same job, so use the Compose database alone or override host ports explicitly.

For the flaky test, the immediate debugging evidence is the first-attempt trace, screenshot, HTML report, browser console/network errors, and server logs around the `loginAs()` URL wait. The current `retain-on-failure` trace should preserve a retry trace on a flaky outcome, but the workflow's `if: failure()` artifact upload skips a green job even when a test only passed on retry. Upload on job completion for this E2E job, or use a condition that also recognizes flaky/retried tests. Keep the retry count at one while gathering evidence; remove the retry only after the startup/navigation issue is diagnosed and stable.

Acceptance criteria for this profile:

1. Both production images build from the checked-out SHA and run as `node`.
2. Migration and canonical seed complete before the API starts accepting browser traffic.
3. `/v1/health/ready` returns ready with database `ok`; `queue:not_configured` is accepted under the Compose profile.
4. Existing desktop and mobile Chromium scenarios pass against the production web and API containers, including login, operational mutations, accessibility, and SEO coverage.
5. The report and useful trace/server artifacts are retained on a retry as well as a hard failure.
6. Teardown removes the temporary database volume even when browser acceptance fails.

This validates image-runtime and browser behavior in CI. It does not replace verification on the actual Render/Vercel/Neon release.

## Release readiness gate and exact-SHA check

The deployment workflow already knows `RENDER_COMMIT_SHA` and the API reports `RENDER_GIT_COMMIT` as `revision`. Add a bounded poll after the deploy-hook POST. A suitable shell shape is:

```bash
deadline=$((SECONDS + 600))
while (( SECONDS < deadline )); do
  body=$(curl --fail --silent --show-error "$API_HEALTH_READY_URL" || true)
  if [[ -n "$body" ]]; then
    status=$(jq -r '.status // empty' <<<"$body")
    revision=$(jq -r '.revision // empty' <<<"$body")
    database=$(jq -r '.checks.database // empty' <<<"$body")
    if [[ "$status" == ready && "$database" == ok && "$revision" == "$RENDER_COMMIT_SHA" ]]; then
      printf 'API ready at revision %s; database %s.\n' "$revision" "$database"
      exit 0
    fi
  fi
  sleep 10
done
echo "Timed out waiting for the expected API revision and readiness." >&2
exit 1
```

`API_HEALTH_READY_URL` must come from a non-secret repository variable or service URL, not from printing a deploy-hook value. The workflow's current early check requires `RENDER_DEPLOY_HOOK_URL`; the observed failure did not show what would happen with the migration secret independently configured. A follow-up should validate both secrets in a safe CI configuration before treating the documented deploy path as operational. Production release evidence should record: CI run/SHA, migration and seed success, hook accepted, readiness status/checks/revision, Render service revision, Vercel deployment revision, and smoke result/time. Do not report a deploy as complete from a successful hook POST alone.

Readiness polling is locally specifiable but cannot be proven against Render without the deploy hook and a real rollout. The code path can be checked with a stub HTTP endpoint or shell-level unit test, but no deployment should be triggered during this discovery task.

## Staging performance evidence

Create a staging-only experiment before making scale claims. A minimal reproducible record should include:

- code SHA and image digest;
- API, database, and runner resource sizes/regions, database pooling mode, and whether the queue is enabled;
- fixture generator/version, tenant count, rows per tenant, and explicit target shape such as 100,000 stock movements and a hot SKU with concurrent confirmations;
- exact schema migrations, seed command, warmup duration, request count, concurrency, and commands;
- workload-specific throughput, p50/p95/p99, error rate, database pool waits, and row-lock wait duration;
- representative `EXPLAIN (ANALYZE, BUFFERS)` results run as the application role, with any sensitive identifiers removed;
- repeated run variation and any threshold used to identify a regression.

Start with read workloads from `scripts/perf-smoke.mjs`. It currently has no fixture-size controls and does not emit lock waits or database pool metrics. Extend it only if needed for an explicitly scoped experiment; a separate staging fixture/load script may be clearer. Do not point `--include-writes` or `--rate-limit-check` at production: both mutate state or deliberately create throttling. The harness output is client-observed wall time and includes network, API and database duration.

Staging data creation, sustained load, and query-plan collection require a staging database and provider credentials, neither of which was verified in this discovery. A local reproducible large-data experiment may be possible once Docker is running, but it cannot substantiate provider-region latency or managed-service behavior.

## Rollback and restore rehearsal

Use a disposable Neon branch/project or an isolated local database with production-like role grants. A safe rehearsal records a baseline, creates a known data state, applies one reviewed migration and app version, then exercises:

1. App rollback: deploy the prior application image against the migrated schema and verify compatibility, health, login, and a read-only business flow.
2. Database restore: restore a disposable clone to a named point before a deliberate test-only data change, run `prisma migrate deploy` with the direct migration URL, verify `rolbypassrls=false`, role membership and append-only ledger privileges, then run health and demo smoke.
3. Decision points: record who pauses traffic, how the previous image/commit is chosen, what confirms the restore point, which invariants block reopening traffic, and how the clone is cleaned up.

Never use the public demo reset as recovery and never restore or roll back production data to create a rehearsal. The existing runbook already distinguishes application redeploy from database point-in-time restore; the missing item is a dated rehearsal record with environment, SHA/migration, commands, duration, checks, deviations, and cleanup result. Provider access or an isolated disposable environment is required to demonstrate the actual restore mechanics.

## Current feasibility and dependencies

Local read-only discovery succeeded in Ubuntu WSL after an initial `E_ACCESSDENIED`; the launcher needed sandbox escalation on subsequent invocations. Runtime available: Node `v24.22.0`, pnpm `10.13.1`. Current local HEAD is the same `312eee9` recorded in the review. The worktree already contains untracked `STOCKPILOT_TECHNICAL_INTERVIEW_GUIDE.md` and `docs/interview-readiness-review-2026-10-18.md`; neither was modified.

The Docker CLI is installed, but `docker info` reports `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`. Docker was not started. Therefore image build or local production-image E2E cannot be repeated here now. Hosted CI has already provided the documented builds and dev-mode E2E for the inspected SHA.

| Evidence/action                                   | Locally feasible now                                                                           | External/provider or environment dependency                                                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review workflow, Docker, readiness and perf code  | Yes; read-only inspection completed.                                                           | None.                                                                                                                                                                                          |
| Add durable production-image CI profile           | Yes as a repository change, subject to CI run.                                                 | GitHub Actions/Docker runner needed to execute it.                                                                                                                                             |
| Diagnose the accessibility retry from CI trace    | Not from the summarized pass/fail counts alone.                                                | Download the Playwright artifact for run `39060081766`; it may not contain a trace because current artifact upload only occurs on job failure. A rerun with artifact retention can capture it. |
| Verify successful Render rollout and SHA gate     | No live rollout performed.                                                                     | `RENDER_DEPLOY_HOOK_URL`, configured service, public API URL, and authorized deployment run. The observed deploy run exited before migration/seed/hook.                                        |
| Verify web SHA on Vercel                          | No independent web deployment evidence inspected.                                              | Vercel deployment details or a deployed web build identifier.                                                                                                                                  |
| Run realistic staging performance study           | No; Docker daemon unavailable and staging not established.                                     | Disposable staging app/database, provider resource visibility, fixture/data privacy plan, and runner location.                                                                                 |
| Rehearse application rollback/PITR restore        | No; no disposable restore target verified.                                                     | Isolated Render/Neon environment or equivalent, provider access, and a safe migration/data-change scenario.                                                                                    |
| Correct private guide and stale architecture text | Exact locations/findings are identified, but edits are outside this discovery-only assignment. | Follow-up plan authorization; the guide is untracked and user-owned.                                                                                                                           |

## Verification plan for implementation

After implementation is separately authorized:

1. Run `pnpm exec prettier --check` for changed Markdown/config and `pnpm lint`/`pnpm typecheck` if code/config changes warrant them.
2. Run existing E2E in dev mode to ensure its default webServer path is unchanged.
3. With Docker available, run the new Compose-backed production-image acceptance profile and confirm it uses the images from the same SHA, exercises both browser projects, retains retry artifacts, and tears down its volume on failure.
4. Validate deploy-poll parsing and timeout paths against a local stub without calling Render; then require an actual authorized staging or production rollout to confirm provider timing and injected revision behavior.
5. Run staging performance and rollback/restore rehearsals only on isolated environments; preserve commands and outcome metadata in the relevant docs.

No tests or Docker services were started as part of this discovery.
