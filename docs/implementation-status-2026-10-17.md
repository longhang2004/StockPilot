# Implementation status — 17 October 2026

The checks below were run on the implementation working tree based on `5265b6fe79e251442251ee8b0a6bd37f6400044a`, before the changes were committed. These results describe local evidence only; they do not establish that a remote CI run or public deployment used the same implementation.

## Audit items

| Item                                   | Implementation in this working tree                                                                                                                                                                                                                                         | Evidence and remaining boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 — CI and revision-gated deploy      | Dependency updates clear the high/critical audit gate; CI runs audit separately from verification. The Render workflow migrates and seeds before invoking a hook with the workflow SHA, and the Blueprint disables automatic deploys.                                       | `pnpm audit --audit-level high` passed. Local CI configuration checks and production image builds passed. The remote CI run for commit `c1f60f8` on `main` passed all three jobs (audit, docker-build, verify) and CodeQL also passed. The Render deploy workflow still fast-fails at its preflight because the `RENDER_DEPLOY_HOOK_URL` repository secret is not configured; Vercel dashboard settings, release SHA adoption, rollback, and database restore remain unverified. |
| R2 — Draft edit versus confirmation    | Draft edits and order transitions share the order-row locking boundary.                                                                                                                                                                                                     | Barrier-controlled edit/confirm tests covered both orderings in the API integration suite (15 files / 78 tests), which passed serially.                                                                                                                                                                                                                                                                                                                                          |
| R3 — Integration retry recovery        | Worker/manual retry paths use the delivery identity and locking; recovery checks pending queue history and paginates retained jobs. A real pg-boss/PostgreSQL regression suite covers recovery, worker/manual retry serialization, dead-letter handling, and retry backoff. | Queue regression passed 4/4. Queue configuration remains optional; live production queue configuration was not verified. Recovery's pending-job lookup and enqueue are separate operations, so this does not promise exactly-once queue insertion. Delivery locking and attempt caps protect domain processing.                                                                                                                                                                  |
| R4 — Idempotency across client retries | User command keys are retained across retries of the same intent and replaced when the intent changes or succeeds.                                                                                                                                                          | Web unit/type checks passed: 19 files / 51 tests; web typecheck passed. Production-image E2E passed 30/30, including the lost-response recovery flow on both desktop and mobile projects. This is local evidence only.                                                                                                                                                                                                                                                           |
| R5 — CSV import contract and recovery  | Import payload handling and wizard state were updated; selecting a new file invalidates stale preview state, and the template/recovery path is exposed.                                                                                                                     | API integration tests verified 150 KB, the 2 MiB boundary, and over-limit/envelope handling. Web wizard tests verified file A→B invalidates the previous preview. Web unit/type checks passed: 19 files / 51 tests; web typecheck passed.                                                                                                                                                                                                                                        |
| R6 — Remove the 100-record UI ceiling  | Inventory and workflow selectors use bounded server queries, with inventory pagination and scoped summary behavior.                                                                                                                                                         | API tests cover a 250-product / 500-movement fixture; web unit coverage verifies remote SKU search. The production-image E2E uses the normal small demo fixture and does not prove the 250-product case.                                                                                                                                                                                                                                                                         |

## Checks completed

- `pnpm audit --audit-level high` — passed, no known vulnerabilities.
- `pnpm format:check` — passed on the final local check.
- `pnpm lint` — passed on the final local check.
- `pnpm typecheck:e2e` — passed on the final local check.
- `pnpm --filter @stockpilot/contracts test` — passed: 2 files / 11 tests.
- Web unit/type checks — passed: 19 files / 51 tests; web typecheck passed.
- API typecheck passed after final queue recovery changes.
- `pnpm --filter @stockpilot/api build` — passed after backend source settled.
- `SITE_URL=https://stockpilot.example pnpm build` — passed for contracts, API, and Next.js production output.
- API unit coverage — 31 files / 118 tests; backend agent reports pass. Aggregate coverage was 62.94% statements and 56.95% branches; the 80% thresholds apply only to four designated core files.
- API PostgreSQL integration — 15 files / 78 tests, serial execution; backend agent reports pass. The final queue regression was rerun after the recovery guard and passed 4/4.
- `docker build -f apps/api/Dockerfile -t stockpilot-api:ci .` and `docker build -f apps/web/Dockerfile --build-arg API_INTERNAL_URL=http://stockpilot-api-smoke:4000 -t stockpilot-web:ci .` — passed; both image configurations run as user `node`.
- Production API readiness — HTTP 200 with database `ok` and optional queue `not_configured`. Production web `/login` and `/` returned 200; the web API rewrite `/api/v1/health/live` returned 200 after starting the dedicated API container on the expected Docker network alias.
- Root's manual production-image browser QA — login and overview at desktop; inventory at 1440×1000 and 390×844; mobile More→Receipts navigation, inventory drawer labels/actions, and visible import upload/template. No CSV upload/commit or business data writes.
- `git diff --check` and `node --check scripts/e2e-server.mjs` — passed after the final document edit.
- After the brand-link fix described below: `pnpm format:check`, `pnpm lint`, and `pnpm --filter @stockpilot/web typecheck` all passed, and `git diff --check` was clean.

## Remote CI after commit `c1f60f8`

The hardening work was committed to `main` as `195e853`; its remote CI run failed only in web unit tests: `workspace-shell` "keeps the session on a transient network failure and recovers on retry" plus an unhandled `workspaces.map is not a function` from `WorkspaceSwitcher`. The same suite passed locally on the identical code, so the failure was a timing race between environments: the stub returned one `Response` instance for every call after the first rejection, the session read consumed its body, and `apiRequest` degrades an unusable body to `{}`, which `WorkspaceSwitcher` treated as truthy list data; locally the component's effect resolved after the test's unmount (`active` guard), while the faster CI machine executed the crash mid-test.

Fix (commit `c1f60f8`): `WorkspaceSwitcher` now stores `/auth/workspaces` payloads only when they are arrays (`Array.isArray` guard; anything else hides the switcher), and the shell spec stubs each endpoint with its own fresh Response so no test depends on consuming a single `Response` twice. Local evidence after the fix: web unit 19 files / 51 tests passed, web typecheck/lint and root `format:check` passed. Remote CI run 39058484127 passed all three jobs (audit 19s, docker-build 2m23s, verify 6m5s), and CodeQL 39058484200 passed.

The follow-up "Render demo deploy" `workflow_run` still fails fast by design: its "Check deployment secrets" step requires the `RENDER_DEPLOY_HOOK_URL` repository secret, and only `MIGRATION_DATABASE_URL` is configured. Deploy stays blocked until the owner adds that secret; the gate is intentionally loud and was not weakened.

## Production-image browser E2E

The committed/default Playwright dev-server run did not reach browser tests in WSL: cold API compilation and readiness took about 170 seconds, exhausting the original 180-second aggregate startup limit. The supervisor's owned-process cleanup was corrected and the startup allowance is now 360 seconds. Chromium OS dependencies were installed after the initial missing `libnspr4.so` error. Production-image browser acceptance uses a temporary config with `E2E_WEB_PORT=3301` and its web server disabled, running against the separately started production API/Web containers; this is separate from the CI/default dev-server configuration.

Run history on the production images (local evidence only):

1. First full 30-test run — 24 passed / 6 failed: desktop/mobile brand accessibility and desktop/mobile recovery-flow alert/reload handling. The visible-brand labels and recovery alert/reload scoping were fixed, and the web image was rebuilt.
2. The next focused desktop run was stopped by the user; the remaining desktop public-page axe failure was `label-content-name-mismatch` (serious): the brand link's visible text is `SP StockPilot` (the `SP` mark is rendered even though `aria-hidden`), while its `aria-label="StockPilot"` did not contain that visible text (WCAG 2.5.3). Fix: removed the redundant `aria-label` from the five brand links (landing page, login, signup, create-workspace, invitation accept). The accessible name stays `StockPilot`, now derived from the visible content; the `SP` mark remains `aria-hidden`. The web image was rebuilt from that source and the smoke container was recreated with the same ports/network; the served HTML was verified to no longer carry the stale label.
3. Focused rerun after the rebuild — 6/6 passed (public-page axe and login/workspace axe plus lost-response command recovery, both desktop and mobile). The recovery test asserts the same payload and idempotency key across attempts, exactly one ADJUSTMENT_IN movement, and a balance that moves to 7 exactly once.
4. Final full run — **30/30 passed in 2.9 minutes** with one worker (`E2E_WEB_PORT=3301`, `WEB_ORIGIN=http://localhost:3301`, `WEBHOOK_SIGNING_SECRET=ci-webhook-secret`, `playwright.prod.config.ts`).

The temporary `playwright.prod.config.ts` was removed after the final green run; stale `test-results/` artifacts from the earlier failures were deleted and `playwright-report/` holds the passing HTML report. The command for a future rerun needs the config recreated from the snippet below.

Reproduction config (temporary; recreate next to `playwright.config`):

```ts
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  webServer: undefined,
  use: {
    ...baseConfig.use,
    baseURL: `http://localhost:${process.env.E2E_WEB_PORT ?? '3301'}`,
  },
});
```

## Still deferred or unverified

The product follow-up scope remains distinct from R1–R6 reliability work: Priority Work Queue still shows counts rather than actionable exception items; Draft editing in the UI; shareable order-detail URLs and navigation state; a receipt-document list/detail experience; and SKU-to-reservation-to-source-document trace. The manual QA checked navigation and visible import template guidance only; it did not upload or commit a CSV. These broader UX/product items are not implied complete by the reliability changes above.

No remote CI result, provider dashboard adoption, external deployment, production queue configuration, rollback rehearsal, or database restore rehearsal is claimed. The Render workflow is hook-only and repository configuration cannot prove that dashboard auto-deploy settings match. Vercel remains a separate provider rollout that must be checked against the same release SHA.
