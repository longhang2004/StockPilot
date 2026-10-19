# Production release verification — 20 October 2026

**PASS within the recorded scope: 46/46 live checks, 24 original screenshots, 14 axe scans with zero reported violations.** No new blocker was observed. This closes the six UI findings using deployed UI checks together with the exact-commit production-image regressions; the two browser-only fixtures below are not server-side business workflow evidence.

- Live origin: <https://stock-pilot-web-five.vercel.app>
- PR [#27](https://github.com/longhang2004/StockPilot/pull/27) merged into `main` at `800d1204e4493d860266c4d19f941b4c4921fbdb`.
- Web `/version`, same-origin API readiness, and direct Render API readiness all returned HTTP 200 and that exact revision. Database readiness was `ok`.
- Observation window: **20 October 2026, 01:15:23–01:18:24 Asia/Saigon**. Machine timestamps in [results.json](results.json) use UTC.
- Chromium 156.0.8078.4 through Ubuntu WSL. Desktop 1440×900; touch/mobile emulation 390×844; additional 320px and 550px reflow probes. Reduced motion enabled.
- No application source, provider configuration, secret, demo reset, or business record was changed. Normal demo login/logout created and revoked sessions. Inventory quantities were compared before/after and remained unchanged.

## Release checks

| Check                    | Result / evidence                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Main CI, exact `800d120` | [39286993965](https://github.com/longhang2004/StockPilot/actions/runs/39286993965): audit, verify, Docker build all successful              |
| CodeQL, exact `800d120`  | [39286994236](https://github.com/longhang2004/StockPilot/actions/runs/39286994236): successful                                              |
| Render release           | [39288468962](https://github.com/longhang2004/StockPilot/actions/runs/39288468962): successful; deployed API revision independently checked |
| Vercel release           | Successful; deployed web revision independently checked                                                                                     |
| CI unit suites           | Contracts 11, API 118, web 77 passed                                                                                                        |
| CI integration suites    | Standard profile 84 passed / 4 queue cases skipped; dedicated real queue profile 4 passed                                                   |
| CI browser suites        | Development profile 46 passed / 2 skipped; production-image profile **49 passed / 1 expected skip**, images reporting exact `800d120`       |

CI also passed format, lint, typechecks including E2E types, operations guards, coverage and production build. The expected production-image skip is the desktop-only Owner sidebar test in the mobile project; this live run additionally checked mobile Owner access through More. CI results describe isolated test environments, not writes against the hosted demo.

## UI finding closure

| Finding                           | Live observation                                                                                                                                    | Selected evidence                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01 More contrast               | Muted label on the light surface; both More axe scans have no violations                                                                            | [Desktop](images/desktop-more-contrast.jpg), [mobile](images/mobile-more-contrast.jpg)                                                      |
| UX-02 Font binding                | Body and heading compute to `sourceSans`; generated font face is loaded and renderable                                                              | [Desktop overview](images/desktop-overview-font.jpg), [mobile overview](images/mobile-overview-font.jpg)                                    |
| UX-03 Settings discovery          | Owner desktop sidebar entry is active; mobile More links to settings; Manager/Staff have no desktop Settings entry                                  | [Desktop Owner](images/desktop-owner-settings.jpg), [mobile Owner](images/mobile-owner-settings.jpg)                                        |
| UX-04 Responsive layout           | Header document fits 320/390/550 CSS px; 64-character SKU form and its controls fit 390px using a browser-only product fixture                      | [320px header](images/mobile-orders-reflow-320.jpg), [390px form fixture](images/mobile-long-sku-browser-fixture.jpg)                       |
| UX-05 Business names              | Real order API names match rendered warehouse/creator names after reload; Staff sees another user's actual name; Back preserves order search/status | [Desktop order](images/desktop-order-business-names.jpg), [mobile order](images/mobile-order-business-names.jpg)                            |
| UX-06 Delivery → order → delivery | Deployed link, order reload and exact return URL preserve selected delivery/search/status/page; succeeded state uses a browser-only fixture         | [Delivery fixture](images/desktop-delivery-link-browser-fixture.jpg), [return link fixture](images/mobile-order-return-browser-fixture.jpg) |

The live route smoke reached overview, orders, inventory, products, partners, receipts, imports, integrations, audit, More and Owner settings in both contexts. Landing and account login passed font/reflow/axe checks; account → demo entry → account navigation worked. These route checks establish loading and the expected UI state, not every write operation on each page.

Manager, Owner and Staff demo logins succeeded. Logout returned 204 and subsequent session lookup returned 401. Staff saw the integration access message and the delivery API returned 403. No uncaught page errors or attempted browser business writes were recorded.

Public entry screenshots: [desktop landing](images/desktop-public-landing.jpg), [mobile landing](images/mobile-public-landing.jpg), [desktop login](images/desktop-public-login.jpg), [mobile login](images/mobile-public-login.jpg). Role boundary: [desktop Staff](images/desktop-staff-role-boundary.jpg), [mobile Staff](images/mobile-staff-role-boundary.jpg). All 24 captures are indexed with URL, viewport and capture timestamp in `results.json`; JPEGs are unretouched viewport screenshots.

## Fixture and accessibility limits

The demo had returned to its canonical dataset: eight products, six orders and one failed delivery with no linked order. To preserve server data:

- **Long SKU:** the browser overlaid one product-search GET response with a 64-character SKU and long label, retaining an existing product ID. The adjustment form was opened but never submitted. No product was created or stock adjusted.
- **Succeeded delivery:** the browser overlaid one delivery-detail GET response with a succeeded status and an existing order ID. Actual order data and deployed navigation code were used. The server delivery remained failed with its original null order link, checked after navigation. No webhook or manual retry was submitted in this run.

These overlays are explicitly marked `persisted: false` in `results.json`. Actual product creation, retry persistence and linked-order behavior have production-image regression coverage; this run does not claim a new hosted retry success. The [older production QA](../2026-10-19-production/README.md) includes actual hosted workflow writes at its older revision and remains historical evidence.

Axe reported no violations in the 14 scanned states. Some checks remain `incomplete` (contrast on overview; contrast/native-select attributes in the form). The raw IDs are retained. This is automated WCAG 2 A/AA and 2.1 AA scanning, not complete accessibility conformance, screen-reader testing or physical mobile/Safari acceptance. Native 200% browser zoom was not repeated here; the measured reflow widths are recorded instead.

The hosted optional queue still reports `not_configured`; background queue processing and payment checkout were not verified on production. Real-user validation and personal interview rehearsal remain **X3 EXTERNAL**.

## Verification history and integrity

Initial QA selectors incorrectly expected standalone exact name text in a fact containing a secondary UUID, and a heading role for an EmptyState title. Screenshot/source inspection confirmed the rendered content. The name check was corrected and the audit rerun; only the affected Staff checks were repeated after correcting the title selector. Final checks compare real API fields, exact visible title text and the server's 403. No application fix was needed. The final record includes these harness corrections.

The original 19 October findings and screenshots have not been overwritten or relabeled. Verify this new bundle from the repository root:

```bash
sha256sum --check docs/qa/2026-10-20-production-release/SHA256SUMS
```

The manifest covers this README, `results.json` and all 24 images; it excludes itself.
