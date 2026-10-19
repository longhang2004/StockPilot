# Local production-image evidence for UX-01–UX-06

This bundle records a fresh, isolated local production-image run for the six fixes. It is local verification, not evidence from a live production deployment. The original findings in `docs/qa/2026-10-19-production/findings.json` remain historical and unchanged.

## Verification

- Production images were built from the frozen working tree and reported API and web revision `u4-review-1dd3f1671308`.
- `pnpm test:e2e:production`: 49 passed, 1 expected skip. The skipped case is desktop-only Owner settings navigation in the mobile project.
- The seven desktop regression cases passed; the six applicable mobile cases passed, with the desktop-only UX-03 case skipped in the mobile project (13 passing regression runs total).
- `pnpm --filter @stockpilot/api exec vitest run --maxWorkers=1 test/orders.integration.spec.ts`: 7 passed against a disposable PostgreSQL 18 container on loopback port 55434 after all 11 migrations applied.
- `pnpm lint` and `pnpm format:check` passed.
- The frozen source patch fingerprint was unchanged after verification: `1dd3f1671308e6f99d38141fd5f83a3cb518ddefc38978c79ba0a8131a234ba3` (`git diff --binary 6eeef56 -- apps packages tests scripts "*.yml" | sha256sum`).

## Screenshot scope

The PNGs under `screenshots/` are selected `verified-view` attachments emitted by passing production regressions. UX-03's passing runtime assertion verifies the Owner entry in the desktop sidebar and preserves the role boundary; its after-test screenshot is not included because the test ends in the Manager view. The narrow reflow test also asserted widths 320, 390, and 550 and compared `document.documentElement.scrollWidth` with `clientWidth`; its attachment shows the final 550px viewport. The separate long-SKU attachment shows the 390px drawer.

UX-01 through UX-06 refer to finding IDs in the original production QA report. Nothing in this bundle updates or relabels that report.

Verify the bundle hashes from the repository root with `sha256sum --check docs/qa/2026-10-19-ui-fixes-local/SHA256SUMS`. The checksum file covers the README, results record, and selected screenshots; it excludes itself.
