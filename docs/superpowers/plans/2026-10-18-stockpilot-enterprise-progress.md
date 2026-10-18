# StockPilot enterprise redesign — execution ledger

**Updated:** 18 October 2026 (Asia/Saigon).
**Plan:** [full task inventory and continuation prompt](2026-10-18-stockpilot-enterprise-redesign.md).

Status meanings: TODO = not started; ACTIVE = implementation underway; CODED = awaiting required verification; DONE = completed with evidence; EXTERNAL = needs provider access, secret, participant or external environment. CODED is not DONE.

## Current checkpoint / resume first

- Baseline branch/revision: `main` at `312eee9`; current branch: `codex/enterprise-redesign-20261018`, based directly on that revision.
- Current work: D2 planning checkpoint is committed; resume F1/F2, B1/B2, O1/O2/E1/E2 in their documented dependency order.
- Pre-existing untracked files: private `STOCKPILOT_TECHNICAL_INTERVIEW_GUIDE.md`, `docs/interview-readiness-review-2026-10-18.md`. Preserve both; do not stage private guide automatically.
- Terminal: Windows launcher → Ubuntu WSL Bash. Node24/pnpm available via `$HOME/.local/opt/node24/bin:$HOME/.local/bin`. WSL needs approved escalation in this sandbox.
- Docker CLI installed; daemon unavailable at discovery. No owned server/test processes started by this redesign yet. Ports 3000/4000 can belong to unrelated projects; use dedicated ports and inspect ownership.
- External: Render deploy hook secret missing; no provider dashboard/PITR acceptance or real-user session completed.

## Task states

| ID  | Task                                                      | Status   | Owner / evidence / next action                                                                                                                                       |
| --- | --------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D0  | Documentation discovery                                   | DONE     | Three cited research/discovery notes under `docs/superpowers/specs/2026-10-18-*`; repository/API and official design docs inspected                                  |
| D1  | Chosen direction and complete plan                        | DONE     | User chose SAP Fiori enterprise; master plan authored before source edits                                                                                            |
| D2  | New design master and planning checkpoint                 | DONE     | Replacement master matches the selected direction. Branch created; Prettier, whitespace and local-link checks passed. See planning checkpoint commit in Git history. |
| F1  | Tokens/font/shell/primitives/all-route visual consistency | TODO     | Depends D2                                                                                                                                                           |
| F2  | Landing/auth/brand/metadata                               | TODO     | Depends F1 foundation                                                                                                                                                |
| B1  | Receipt documents/SKU trace/entity audit APIs             | TODO     | Depends D2; publish exact contracts for feature UI                                                                                                                   |
| B2  | Safe Draft create command path                            | TODO     | Depends D2                                                                                                                                                           |
| U1  | URL Orders/Draft edit/create recovery                     | TODO     | Depends F1/B2                                                                                                                                                        |
| U2  | Real actionable worklist/contextual exceptions            | TODO     | Depends F1 and destination URL support                                                                                                                               |
| U3  | Receipt/SKU/audit/integration source navigation           | TODO     | Depends F1/B1                                                                                                                                                        |
| O1  | Production-image browser CI and flake artifacts           | TODO     | Depends D2; execution needs Docker                                                                                                                                   |
| O2  | Exact-revision deploy check/web revision/docs             | TODO     | Depends D2; provider rollout remains X1                                                                                                                              |
| E1  | Guarded performance/recovery experiment                   | TODO     | Tooling feasible; measurements depend isolated runtime                                                                                                               |
| E2  | Interview guide/demo/docs/screenshots                     | TODO     | Guide/docs can begin; new screenshots depend Q1                                                                                                                      |
| Q1  | Integrated verification/visual/accessibility review       | TODO     | Wait for settled implementation                                                                                                                                      |
| Q2  | Verified Git checkpoint/remote checks                     | TODO     | Wait for coherent verified work                                                                                                                                      |
| X1  | Provider secret/settings/live release verification        | EXTERNAL | Missing deploy hook; do not paste secrets into chat                                                                                                                  |
| X2  | Managed-service rollback/PITR rehearsal                   | EXTERNAL | Disposable provider environment/access required                                                                                                                      |
| X3  | Real-user validation/personal interview rehearsal         | EXTERNAL | Prepare task sheet; participants and candidate practice required                                                                                                     |

## Evidence and decisions

- 18 October: local/remote baseline `312eee9`; CI/CodeQL green, 29 E2E pass + 1 flaky; live API healthy at `195e853`, queue optional/unconfigured. These are baseline evidence, not verification of the redesign.
- 18 October: user confirmed cool light/navy SAP Fiori direction; official SAP and Adobe Source Sans research saved. Generic skill output proposing green/Inter/oversized hero is rejected because it conflicts with the selected direction.
- Planning milestone: full plan includes all prior audit gaps, product redesign, exact verification criteria and explicit external acceptance tasks.

## At every handoff

Current branch: `codex/enterprise-redesign-20261018`, based at baseline `312eee9` with D2 planning checkpoint committed. Planning files and the historical audit report are committed; private `STOCKPILOT_TECHNICAL_INTERVIEW_GUIDE.md` remains untracked. No implementation source changes, server/test processes, or owned ports are active. Latest checks: targeted Prettier check and `git diff --check` passed; all local Markdown targets in the seven checkpoint documents exist. Next task: start F1 (visual foundation) and B1/B2/O1/O2/E1/E2 in parallel using the ownership rules in the plan; do not begin U1/U2/U3 until F1 and B1/B2 dependencies are ready. External X1/X2/X3 remain open.
