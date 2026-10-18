# StockPilot enterprise redesign and readiness plan

**Created:** 18 October 2026 (Asia/Saigon). **Baseline:** `312eee9`.
**Status source of truth:** [execution ledger](2026-10-18-stockpilot-enterprise-progress.md).

## Start here, including after an interrupted session

Read this plan, the execution ledger, [design research](../specs/2026-10-18-design-research.md), [workflow discovery](../specs/2026-10-18-workflow-discovery.md), [operations discovery](../specs/2026-10-18-operations-discovery.md), and `design-system/stockpilot/MASTER.md`. Inspect `git status` before doing anything. Continue the first unfinished task whose dependencies are complete. Do not restart completed work or assume an implementation is verified because its checkbox exists.

User authorization: research and radically redesign the UI/UX, close the readiness gaps from the 18 October audit, implement the plan, and record completed work for another agent to resume. The user explicitly selected **SAP Fiori-informed enterprise UI, cool light surfaces, navy, minimal decoration**. Any subagents must use **GPT 6 Luna**. Earlier authorization permits commit/push when useful; publish only verified work and preserve private/unrelated files.

All terminal work must run in Ubuntu WSL Bash. On the Windows-hosted command tool use `wsl.exe --distribution Ubuntu --cd /mnt/c/Users/hi/src/personal_repos/StockPilot --exec bash -lc '<command>'`; use the approved escalation path if sandbox WSL access returns E_ACCESSDENIED. Do not silently substitute PowerShell for actual commands. For Linux Node/pnpm add `$HOME/.local/opt/node24/bin` and `$HOME/.local/bin` to PATH. Do not repurpose HOME/CODEX_HOME. Never print `.env` or credentials.

## Outcome and boundaries

Deliver a visually different product that helps a wholesale operator find the next exception, edit/approve/fulfill a customer order, receive a complete supplier document, and explain stock from its reservations and source documents. Keep the existing modular monolith, tenant/auth boundaries, database invariants and command recovery. Improvements must remain demonstrable in a production build.

The plan also covers CI/release evidence, realistic performance tooling, rehearsal instructions/results where locally feasible, interview-guide corrections and refreshed demo materials. External provider configuration, managed-service rollback/PITR and real-user validation require their own evidence. They stay explicitly unfinished until performed; a runbook or local substitute does not close them.

## Design contract to implement

Primary reference is [SAP Fiori list report/object page](https://help.sap.com/docs/SAPUI5/b2f662dd9d7a4ec680056733050b4d34/c0eec49db81a441e878f528c8f3d28de.html), with [worklist](https://www.sap.com/design-system/fiori-design-web/v1-120/page-types/floorplans/work-list) for exceptions and processing queues. Implement the patterns in the existing React/native HTML controls; no framework migration. Fluent typography guidance is supporting research, not another visual language.

- Replace warm bone/terracotta/IBM Plex with cool canvas `#F3F6F8`, white surfaces, navy ink/shell `#102A43`, action blue `#1769AA`, supporting text `#526272`, rules `#CDD6DF`. Validate foreground/background pairs before considering tokens complete.
- Self-host **Source Sans 3**, regular/semibold/bold or one variable WOFF2 from Adobe; bundle OFL license and record provenance. Use tabular numerals for numeric columns. Replace old font references, metadata theme colors, favicon/app icons and social previews.
- Use a 4px spacing grid, 2–4px control corners, clear table rules, sentence-case labels, page title/toolbar/filter/table hierarchy, compact contextual record headers and limited elevation for overlays. No decorative gradients, oversized hero typography, glass, entrance choreography or repeated eyebrow/rounded-card compositions.
- Desktop: navy global structure with a clear organization/session area, grouped functional navigation and white data workspace. Mobile: four labeled primary destinations, >=44px touch targets, readable forms, no page overflow, record identity/status/next action first.
- Overview is a real worklist; analytics becomes supporting information. Orders/catalog/inventory are list reports. A selected order/receipt/SKU has an object-oriented header and structured facts/history. Keep accessible dialogs for focused create/edit tasks when useful.
- Landing is a concise product introduction with current product evidence and immediate Manager/Staff/Owner entry; authentication screens are focused forms. Replace vague promotional copy with concrete task descriptions and remove obsolete screenshots from prominent use until refreshed.
- Keep loading/empty/error/success/focus/disabled states and unknown-outcome recovery. Status color always has a text label. Preserve keyboard access, focus restore, reduced motion and 200% zoom usability.

The skill search was run in discovery; its generated green/Inter/oversized-minimalism suggestion conflicts with the selected direction and is rejected. The product-specific spec above and the master document govern implementation.

## Documentation and allowed APIs (phase 0 output)

- Installed Next documentation at `apps/web/node_modules/next/dist/docs/` is authoritative per `apps/web/AGENTS.md`. Read `01-app/03-api-reference/02-components/font.md` for `next/font/local` (`src`, `weight`, `variable`, `display`, `preload`), and `04-functions/use-router.md` / `use-search-params.md` for URL behavior. `useSearchParams` is read-only; clone with `new URLSearchParams(...)`. Use `Link`, `router.push` and `router.replace` from `next/navigation`; do not invent navigation APIs or inject untrusted hrefs.
- Reuse `usePage`, React Query query keys/invalidation, Zod contracts, native form controls, existing overlay focus management and `useCommandMutation`.
- Reuse `TenantDatabase.withTenant`, `executeIdempotent`, existing shared order locks and permission decorators. All new reads remain tenant scoped, bounded/paginated, and documented in OpenAPI.
- Existing reusable data sources: `/orders`, `/orders/:id`, `PATCH /orders/:id`, `/alerts`, `/integration-deliveries`, `/inventory/movements`, `/audit-events`. Reservations derive from confirmed order lines; confirmation is not an on-hand movement.
- Font files: official [Adobe Source Sans](https://github.com/adobe-fonts/source-sans/tree/release) and [license](https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md). No runtime Google Fonts requests or unlabeled downloaded assets.

## Task checklist and implementation phases

Checkboxes here describe the original task inventory; the ledger records current state, ownership, evidence and resume instructions. A task is DONE only after implementation and its verification pass. Agents write an assigned task note and do not concurrently edit the ledger.

### Phase 0 — Discovery and durable handoff

- [x] **D0** Inspect current code, dependencies, audit, CI/deploy and existing design system; gather official design/API/font documentation.
- [x] **D1** Lock the user's chosen direction; author this complete plan before implementation.
- [x] **D2** Replace the old design master with the new specification, create execution ledger, verify doc links and save a planning checkpoint on `codex/enterprise-redesign-20261018`.

Verification: discovery notes cite exact APIs/files, master reflects the user's selection, plan has dependencies and completion criteria, private interview guide and prior audit are preserved. Source changes start after this phase is reviewable.

### Phase 1 — Visual foundation and public experience

**F1. Tokens, typography, navigation and shared controls** (depends D2)

Scope: `design-system/stockpilot/MASTER.md`, `apps/web/app/layout.tsx`, `app/fonts/`, `app/styles/foundation.css`, workspace shell/primitives/responsive styles, `components/ui/`, `components/app/workspace-navigation.tsx` and shell/session states. Replace conflicting old CSS rather than layering an entire second stylesheet of overrides. Preserve class/API compatibility needed by existing workflows. Document any new classes used by feature agents.

Implement all control states, table/filter/toolbar hierarchy, low-radius surfaces, numeric alignment, mobile priorities and a shell that visibly differs from the old design. Keep icons from one installed family. Make all existing routes (including products, partners, imports, integrations, audit and settings/billing/team) coherent, not just Overview.

Verify: web typecheck/unit tests; contrast calculation for all semantic text/control pairs; browser inspection at 390, 768, 1024 and 1440px, keyboard/tab/focus, 200% zoom and reduced motion. Screenshots of actual served code. No claimed complete visual QA from source inspection alone.

**F2. Landing/auth/brand surfaces** (depends F1 foundation; may share visual worker)

Scope: `app/page.tsx`, login/signup/create-workspace/invitation pages, auth components/styles, marketing styles, `public/favicon.svg`, icon/apple/social image/manifest metadata and associated content/SEO tests. Replace the old marketing structure/copy rather than recoloring it. Make primary demo entry obvious within the first viewport, use real current product screenshots once phase Q1 captures them, retain correct canonical/noindex/JSON-LD behavior.

Verify: unit tests for useful product content/demo destinations (avoid brittle full-copy snapshots), production build/SEO tests, public/auth axe and visual inspection. No stale IBM/warm-color tokens or old screenshot masquerading as the new UI.

### Phase 2 — Backend read models and Draft command safety

Can run alongside Phase 1 after D2. One backend owner controls shared contracts/OpenAPI and publishes exact response shapes before Phase 3 starts.

**B1. Receipt documents, SKU trace and entity audit**

Scope: `packages/contracts/src/inventory.ts` and exports, inventory controller/query/service modules, audit schemas/controller/query, OpenAPI schemas and relevant integration tests. Add:

- `GET /receipts` with bounded page/pageSize and receipt-number/supplier search; `GET /receipts/:id` with header, supplier identity, all document lines and product identity. Stable sort and totals must represent documents, not movement rows.
- A bounded product trace read model, preferred route `GET /inventory/products/:id/trace`, containing product/balance, current reservations from CONFIRMED order lines and source-bearing movements. Independent pagination for reservations and movements, or separate bounded endpoints if the concrete implementation is simpler; document the final contract in the task note before UI work.
- `entityId` filtering on existing `/audit-events`, alongside entityType. Preserve `audit:read` and tenant isolation.

Do not modify ledger math or emit fake reservation movements. Keep `available = onHand - reserved`; provide source IDs/labels for links, not browser-supplied authorization context. No schema migration unless discovery shows necessary data is absent.

Verify on PostgreSQL: document grouping/search/pagination/detail; foreign-tenant IDs cannot expose data; confirmed reservations sum to the balance for the fixture, disappear after fulfill/cancel; receipt/order source references resolve; audit entity filters isolate exact objects; invalid IDs/query bounds and missing records return appropriate errors. Update OpenAPI contract tests.

**B2. Idempotent Draft creation**

Scope: order POST/controller/service, contracts/OpenAPI metadata and tests. Reuse transaction-backed `executeIdempotent` for a stable create scope. To preserve compatibility during independent web/API rollout, an absent header may retain the documented legacy behavior; when supplied it must be validated and replayed safely. The redesigned first-party client always supplies a key. Explicitly document that legacy requests without keys do not gain retry safety.

Verify: same key/payload gives the same order once; changed payload returns 409; concurrent duplicate requests create one order/audit event; keys are tenant scoped; existing no-key clients keep their explicit compatibility behavior. Keep webhook creation paths compatible.

### Phase 3 — Complete product workflows with the new design

Depends F1 and B1/B2 contracts. Feature owner controls `features/overview`, `orders`, `inventory`, `receipts`, integration/audit deep-link behavior and an optional small shared URL helper. Coordinate CSS ownership with F1; do not overwrite shared foundation.

**U1. URL-aware orders, editing and create recovery**

- Normalize search/status/page/selected order from URL; canonical detail key `order=<uuid>`. Use replace for search/filter changes, push/Link for object navigation, preserve remaining filter context. Reload and Back/Forward restore the visible object and list state.
- Reuse the Draft form for edit with existing PATCH API and loaded customer/products even when absent from the first catalog page. A confirm-during-edit conflict keeps user input and offers refresh/review; unauthorized or non-Draft edits stay unavailable.
- Use `useCommandMutation` and exact saved payload/key for create; retain unknown outcomes across close/reload, show recovery action, prevent a fresh duplicate submit and block expired automatic replay. On known success open the created object, refresh the list and relevant summaries.
- Build a contextual order object view with customer, state/value, lines, transitions, audit/source links and clear permitted actions.

Verify: UI tests for prefilled edit, dirty-form cancel, status conflict; browser search/filter/page/detail reload + Back/Forward; lost successful create response then reload/retry leaves exactly one Draft with the same key/payload. Desktop and mobile.

**U2. Actionable worklist and contextual exception handling**

- Replace count-only Overview queue with bounded real Draft/low-stock/failed-delivery items. Reuse existing paged APIs (no additional composed endpoint required). Provide identity, source-derived reason, time, lifecycle/status and one clear destination/action. Loading/failure of one source must be visible, not treated as zero.
- Link Draft to `orders?order=...`; low stock to SKU trace or receipt create with `product=...` preselected; failed delivery to `integrations?delivery=...`. Read destination params and fetch exact objects outside the first list page.
- Keep KPIs compact and secondary; analytics does not displace the queue on the first screen. Permission-aware copy/actions for Staff versus Manager/Owner.

Verify: seeded items are identifiable and open correct object; zero/error/loading states honest; pagination/links work when object is not in first page; role checks still enforced server-side; overview refreshes after mutations.

**U3. Receipt object pages, stock explanation and audit navigation**

- Replace Receipt movement list with receipt-document list/detail at `receipts?receipt=...`: supplier, reference/date/note, line quantities/costs, linked SKU trace and permitted audit trail.
- Inventory selection/deep link `inventory?product=...` explains on-hand/reserved/available, current orders holding units and paginated source-bearing movements. Receipt/SALE references link to their source; adjustments remain identifiable and auditable.
- Audit accepts entityType/entityId URL filters and shows the scoped context; integration selection uses `delivery`. Preserve list filters when closing/backtracking and provide not-found/error recovery.

Verify: multi-line receipt is one list document, details and source links correct; direct reload works; current reservation totals and ledger remain distinct; empty reservations after fulfillment/cancel; cross-tenant access fails; meaningful narrow-screen layout and keyboard navigation.

### Phase 4 — CI, release checks, evidence and interview accuracy

Can begin after D2 independently of visual/API source, but final browser suites wait for Phase 3.

**O1. Durable production-image browser acceptance and flake evidence**

Scope: dedicated production Playwright config, isolated Compose/runner scripts, `.github/workflows/ci.yml`, test supervisor/report config and only necessary E2E expectation changes. Build the images once for the tested checkout; run real API/web images against a disposable PostgreSQL volume, migrations and canonical seed. Use a dedicated project/network/ports and cleanup only resources owned by that run. Queue regression remains separately real and optional to demo runtime.

Retain browser report/trace when a test retries even if the overall job succeeds. Investigate existing 5s login URL timeout; production profile should remove dev compilation races, not mask application errors with many retries. Keep development E2E usable.

Verify: compose config parses; both browser projects run against production images and same revision; readiness and web proxy work; artifacts retained and owned resources cleaned on success/failure; no user ports 3000/4000 or unrelated containers stopped.

**O2. Release revision/readiness gate and accurate operations docs**

Scope: deploy workflow plus a small bounded polling script and meaningful stub check. After hook submission poll API readiness until exact expected SHA and required dependencies are ready, with timeout/actionable failure. Add a web revision marker that identifies the web build itself rather than only the proxied API; inject git SHA at Docker/Vercel build as supported. Read provider documentation before changing deployment parameters. Keep secret preflight strict.

Align architecture/deployment/operations descriptions with hook-only Render configuration; separate liveness from readiness and schema compatibility from application rollback. Record missing secrets/dashboard access explicitly. Verify polling success/wrong revision/dependency down/timeout against a local stub without triggering production.

**E1. Reproducible performance and recovery experiment**

Provide a guarded local/staging fixture and read workload protocol: named disposable tenant/database, meaningful product/order/movement scale (target 100k movements if resources allow), warmup, repeated runs, latency percentiles/error counts, runtime/resources/SHA and exact commands. Collect selected EXPLAIN ANALYZE BUFFERS under app role and a bounded contention experiment if feasible. Never run load generation or destructive rehearsal on the public demo.

With Docker available, execute the local experiment and a disposable backup/restore or old-image compatibility check where feasible; record measured result/limits. Provider-specific performance/PITR/rollout remain open until actually exercised. No scaling claims from fixture size or theoretical indexes alone.

**E2. Interview material, screenshots and demo proof**

Correct the user-owned untracked interview guide in place: B-tree complexity/lock wait, limited deadlock claim, HTTP disconnect versus database transaction, readiness SELECT 1/read-only limitation, RLS versus query plan and any test/deploy drift found. Preserve its private/untracked status. Add concise tracked technical-decision/demo documentation using actual current code and evidence; disclose boundaries and AI-assisted verification accurately.

After Q1 capture new desktop/mobile screenshots for README/public assets/social preview; synchronize dates/provenance and walkthrough. Replace stale architecture copy and distinguish historical/local/remote evidence. Keep the prior audit as historical rather than silently rewriting its findings.

### Phase 5 — Integration, verification and checkpoint

**Q1. Verify the integrated product** (depends F1/F2/B1/B2/U1/U2/U3/O1/O2)

Run once against settled code, then rerun only affected checks after any fixes:

1. Formatting, lint, contracts build, API/web/E2E typechecks and unit suites.
2. PostgreSQL integration, dedicated real queue regression, targeted new recovery/workflow checks.
3. Production build, Docker images/non-root/runtime health, production-image full browser suite on desktop/mobile.
4. Axe on public/auth/core workflow screens; manual visual/keyboard QA at 390, 768, 1024 and 1440px, zoom/reduced motion, overflow and loading/error/empty/unknown-outcome states.
5. Code quality/anti-pattern review: tenant/context safety, bounded queries, no obsolete warm palette/IBM fonts/old fake imagery, no duplicated legacy CSS alongside the new layer, no invented APIs, no unverified claims.

Save exact commands/counts/SHA/build mode, screenshots, unresolved failures and artifact locations in the ledger/task notes. Do not repeat old local 30/30 as proof for changed code. Prefer production artifact evidence over dev-only success.

**Q2. Verified Git checkpoint and remote verification**

Create/use `codex/enterprise-redesign-20261018`. Commit only coherent, verified changes with explicit paths; exclude `.env`, reports/caches and the private guide unless the user later requests publishing it. Push verified branch/checkpoint when useful; if updating main, preserve normal fast-forward/history and require exact-SHA CI evidence. Attach any created PR using the app tool. No force push or release tag is required.

Record commit, remote CI/CodeQL results and production browser outcome. If CI finds an actionable regression, fix and verify it. Do not claim live rollout from a pushed commit. Every time work stops update the ledger's next action, current branch, dirty files, processes/ports and known failures.

### Phase 6 — External acceptance, still required for full readiness

**X1. Live release:** supply the missing deploy hook through the secret manager, confirm Render/Vercel dashboard settings, deploy selected verified revision, confirm web/API revision markers and smoke. Never ask the user to paste secrets into chat.

**X2. Provider rehearsal:** use a disposable provider environment for previous-app compatibility/rollback and database PITR/restore. Save environment, baseline, duration, invariants, deviations and cleanup. A local pg_dump rehearsal is useful evidence but not proof of Neon PITR.

**X3. Real-user validation and personal interview readiness:** prepare concrete tasks and observation sheet, then have a few warehouse/wholesale-adjacent users attempt them. Record actual friction and iterate. Rehearse code/test-backed deep dives, live coding and CS fundamentals. Do not invent participants, success rates or hiring outcomes.

## Coordination, verification and stop protocol

- Initial parallel lanes: visual foundation F1/F2; backend B1/B2; operations O1/O2/E1/E2. Distinct file ownership. Backend owns contracts/OpenAPI; visual owner owns shared CSS/layout. Product UI begins after contracts are published and foundation review.
- Use GPT 6 Luna subagents for implementation and independent verification/quality review per `do`. Coordinator authors plan, routes context, resolves ownership and verifies evidence. Dependencies are sequential even when independent searches/checks run in parallel.
- Task notes: `docs/superpowers/progress/2026-10-18-<task-id>.md`, including touched files, docs read, commands/results, unresolved issues and exact next command. The main ledger is updated by the coordinator.
- Never mark tests DONE from a successful command that did not reach tests; report skips, flakes and stale server/image provenance. Environment failures are not implementation pass results.
- If quota/context ends: preserve work, record the latest checkpoint/dirty state and start command, stop owned helper processes if they would conflict with continuation, and state which tasks remain. Do not erase partial changes or restart unrelated apps.

## Copy/paste continuation prompt

> Continue StockPilot according to `docs/superpowers/plans/2026-10-18-stockpilot-enterprise-redesign.md`. Read its execution ledger and design master first, inspect git status and task notes, then resume the first unfinished dependency-ready task. The user selected SAP Fiori-informed enterprise UI, cool light/navy, minimal decoration and Source Sans 3. All terminal commands run through Ubuntu WSL Bash. Use GPT 6 Luna for any subagents. Preserve existing private/unrelated files and security/concurrency guarantees. Update statuses with actual verification evidence; keep provider secrets/deploy/PITR and real-user acceptance open until exercised. Continue implementation, verification and coherent Git checkpoints; do not merely produce another plan.
