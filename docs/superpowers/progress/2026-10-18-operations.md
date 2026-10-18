# Operations, performance, and interview evidence

Date: 2026-10-18  
Owner: operations_discovery  
Plan: docs/superpowers/plans/2026-10-18-stockpilot-enterprise-redesign.md

## State

O1 and O2 implementation plus focused static/stub validation are CODED. The production image/browser acceptance itself has not run; the integrated source gate is still pending. E1 guarded tooling is CODED, but the isolated 100k local measurement, EXPLAIN output, and pg_dump/restore rehearsal are deferred until the coordinator's integrated source/build gate. E2 corrections, decision notes, and a blank user-test sheet are CODED; no participant session or refreshed screenshot is claimed. Provider rollout, managed-service PITR/rollback, and real-user acceptance remain external/open.

No Docker containers were started, stopped, or removed by this operations lane. In the latest inventory, Docker Desktop 29.8.2 was available and the backend lane's stockpilot-redesign-db occupied loopback port 55433. Existing ports 3000 and 4000 plus database ports 55432/55433 are reserved by the operations runners. The runner's default web/API test port is 4187; the local performance runner defaults to 4300. Both fail if their selected port is already occupied and clean only a unique Compose project. A Docker Desktop forwarding failure was observed by the backend lane on an earlier host bind; no Docker configuration was changed to work around it.

## O1: production-image browser profile

Added docker-compose.production-e2e.yml, playwright.production.config.ts, and scripts/run-production-e2e.sh. CI builds the production API and Next.js images once for the tested checkout, runs them against PostgreSQL 18 with migrations and the canonical seed, checks API database readiness and exact image revisions, checks the separate web /version endpoint, confirms both images run as the node user, then runs the desktop and mobile Chromium E2E projects. The profile uses its own Compose project/network/volume and loopback web port; the API and DB do not publish host ports. The runner passes /dev/null as the Compose env file so the repository .env is not imported. Cleanup removes only the generated project and its named volume.

trace retain-on-failure preserves the first failing attempt for a test that later passes its single retry. CI uploads development and production Playwright report/result directories with if: always(), so a flaky retry does not hide its trace. The known 5-second loginAs() URL assertion remains at its default Playwright expect timeout; it was not lengthened to mask the navigation/startup issue. The historical 29/30 E2E result belongs to the prior baseline, not this redesigned source.

## O2: exact-revision release check

Added scripts/check-release-readiness.mjs and deterministic Node tests. The Render workflow now requires the migration URL, deploy hook, and RENDER_API_URL repository variable, triggers the hook with the CI-passed commit SHA, then polls /v1/health/ready for up to ten minutes until HTTP 200, status=ready, database ok, and exact revision all match. Queue not_configured remains acceptable only for QUEUE_REQUIRED=false. The poller never includes the configured URL in its error output.

Added the dynamic web GET /version route. It reports Vercel's VERCEL_GIT_COMMIT_SHA when system variables are exposed, otherwise Docker-provided WEB_REVISION, and returns no-store plus X-Robots-Tag noindex, nofollow. It is not added to the sitemap. The route-handler implementation follows the installed Next docs at apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md; SEO behavior was checked against apps/web/app/sitemap.ts and apps/web/app/robots.ts. Provider documentation reviewed: [Render deploy hooks](https://render.com/docs/deploy-hooks), [Render deploys](https://render.com/docs/deploys), and [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables). Current provider secrets/settings are not present for a live rollout; preflight historically stops before migration/trigger when RENDER_DEPLOY_HOOK_URL is missing.

## E1: guarded local/staging protocol

scripts/perf-target.mjs and its Node tests gate non-loopback traffic behind an explicit disposable-staging host acknowledgement and disable staging writes and rate-limit workloads. It rejects credentials, query strings, fragments, and non-origin URLs so output cannot echo credential-bearing API URLs. scripts/perf-smoke.mjs supports sequential warmup and an authenticated movement-list read alongside order/balance reads; it records the readiness revision, host, p50/p90/p95/p99, throughput, error counts, concurrency, and request count.

pnpm perf:local [rows] runs against a unique disposable production API + PostgreSQL project. It seeds up to 100,000 synthetic movement rows for one demo product while advancing that fixture's balance consistently, performs three read-only measurements with 20 sequential warmups and 100 samples at concurrency 10, runs the selected movement query's EXPLAIN (ANALYZE, BUFFERS, SETTINGS) as stockpilot_app under the tenant GUC, and tests a logical backup restore into a second database by checking the synthetic movement count. The dump, three JSON runs, query-plan output, and Compose logs are under ignored test-results-performance/. The runner uses only its isolated demo database, reserves all known application/backend ports, and removes its own project after capturing logs.

This measurement protocol and restore check are preparation only; no Docker build, fixture, query, performance result, or local restore was run from this lane before the integration gate. A local logical restore cannot establish Neon PITR, production image compatibility, or managed-service rollback. Staging remains opt-in and was not contacted.

## E2: evidence and interview guide

Updated docs/architecture.md, docs/deployment.md, and docs/operations.md to match hook-only Render rollout, strict secret/variable preflight, readiness versus liveness, exact API SHA polling, separate web revision, and the limitations of a local restore. Added [technical decisions](../../technical-decisions.md) with current code-backed trade-offs and [demo validation sheet](../../demo-validation-sheet.md) as a blank preparation sheet, not participant evidence.

Corrected the private, untracked STOCKPILOT_TECHNICAL_INTERVIEW_GUIDE.md: deterministic locks prevent the specific reverse-order cycle, not every deadlock; client disconnect is not proof of transaction cancellation; readiness SELECT 1 does not establish write availability; B-tree lookup is typically O(log N), not O(1); RLS does not force an index scan; runtime ledger grants do not constrain owner/migration credentials; queue processing may be separate from the primary DB; current Playwright pin is 1.64.1 and configured browser projects are desktop/mobile Chromium. Replaced stale machine-specific file URLs in the guide with repository-relative links. Kept the guide untracked. Screenshots remain for integrated visual QA after Q1.

## Focused verification run

Commands run after source additions:

- pnpm test:ops-guards — 8 passed, 0 failed: readiness success, old SHA, degraded dependency, timeout without URL leak, loopback, staging gate, remote write rejection, and URL validation.
- pnpm --filter @stockpilot/web exec vitest run app/version/route.spec.ts — 1 passed, 0 failed: web revision precedence, no-store, and noindex header.
- bash -n scripts/run-production-e2e.sh scripts/run-local-performance.sh — passed.
- node --check scripts/perf-smoke.mjs; node --check scripts/perf-target.mjs; node --check scripts/check-release-readiness.mjs — passed.
- docker compose --env-file /dev/null --project-name stockpilot-production-e2e-config --file docker-compose.production-e2e.yml config --quiet — passed.
- docker compose --env-file /dev/null --project-name stockpilot-local-perf-config --file docker-compose.production-e2e.yml --file docker-compose.performance.yml config --quiet — passed.
- Fail-fast probes with ports 55433 and a credential-like URL query — passed; reserved ports were rejected before Docker and the query value was not echoed.
- Targeted pnpm exec prettier --check across supported owned TS/JS/YAML/Markdown files — passed. Shell scripts and SQL have no configured Prettier parser; both shell scripts passed bash -n.

Not run by this lane: full API/web build, DB integrations, production-image Compose startup, production Playwright, 100k fixture, local query plan/backup restore, staging load, or any provider action. Per coordinator instruction, run production and performance checks after the integrated source/Q1 gate is quiet and settled; keep X1/X2/X3 external until their secrets/environment/participants exist.
