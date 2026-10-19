# Production UI/UX and feature verification — 19 October 2026

**Outcome: VERIFIED WITH OPEN FINDINGS.** Core business workflows worked on the deployed application. Six UI/UX findings remain open; this run does not establish that production is accessibility-clean or visually complete.

- Origin: https://stock-pilot-web-five.vercel.app
- Exact web/API revision: 4b97984b3edd387ad29d9be5b64e3f695e602556
- Observation window: 19/10/2026, 11:39:35 → 19/10/2026, 11:54:14 (Asia/Saigon). JSON timestamps use UTC.
- Browser: Chromium 156.0.8078.4 through Ubuntu WSL; direct Microsoft Edge desktop cross-check.
- Desktop 1440×900; touch/mobile emulation 390×844; additional 320px/550px reflow probes.
- Browser timezone Asia/Ho_Chi_Minh; reduced motion enabled for reproducible captures.
- 82 original screenshots, two catalog CSV downloads, sanitized result JSON and SHA-256 manifest. Images were not retouched.
- No application source, provider credential, deployment or workspace reset was changed. Synthetic demo data was written and is listed below.

Open the [filterable evidence gallery](index.html). Raw results: [routes/axe](run.json), [workflows/layout/typography](features.json), [command recovery](recovery.json), [findings](findings.json), [screens](screens.json), [SHA-256 manifest](manifest.json).

## Coverage and observed result

The route/axe matrix completed **33/35 checks** and 32 captures. Its two failures are the same More-label contrast defect on desktop/mobile. Captured surfaces: landing, account login, signup, missing-token invitation, Manager overview/orders/inventory/products/partners/receipts/imports/integrations/audit/More, Manager settings access state, and Owner settings. No critical axe violations or uncaught page errors were observed in those captured states.

The workflow/reflow set completed **26/29 checks**. Its failures are narrow-header overflow at 320px in both contexts and long-SKU adjustment-form clipping at 390px. Business workflows passed. Controlled mobile command recovery also PASS.

| Workflow / check                                                  | Desktop | Mobile |
| ----------------------------------------------------------------- | ------- | ------ |
| empty search and clear recovery                                   | PASS    | PASS   |
| drawer keyboard escape and focus                                  | PASS    | PASS   |
| receipt UI writes one inbound movement                            | PASS    | PASS   |
| create Draft, URL history and edit persist after reload           | PASS    | PASS   |
| Manager confirm reserves exactly one unit                         | PASS    | PASS   |
| Staff access boundaries and fulfillment                           | PASS    | PASS   |
| Owner audit actors, detail and Escape                             | PASS    | PASS   |
| CSV invalid preview and valid commit/export                       | PASS    | PASS   |
| manual integration retry has durable outcome                      | PASS    | PASS   |
| browser-only read error and retry                                 | PASS    | PASS   |
| reflow at 320px                                                   | FAIL    | FAIL   |
| reflow at 390px                                                   | PASS    | PASS   |
| reflow at 550px                                                   | PASS    | PASS   |
| sign out returns real account login                               | PASS    | PASS   |
| long-SKU adjustment drawer fits 390px                             | NOT RUN | FAIL   |
| Lost response → reload → same-command recovery → balance restored | NOT RUN | PASS   |

The injected 503 and dropped response occur only inside the test browser. They are **controlled experiments**, not natural server outages. The manual integration retry actually succeeded inline while the optional hosted queue remained unconfigured; this proves the manual path, not background processing. On mobile that delivery was already Succeeded and its retry control was absent as expected.

## Open findings

| ID / priority | Finding                                                               | Primary image                                                                       |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| UX-01 / P2    | Low-contrast role label on More                                       | [desktop-more.jpg](images/desktop-more.jpg)                                         |
| UX-02 / P2    | Source Sans 3 is not the rendered font                                | [desktop-overview.jpg](images/desktop-overview.jpg)                                 |
| UX-03 / P2    | Owner settings has no visible desktop navigation entry                | [desktop-owner-navigation.jpg](images/desktop-owner-navigation.jpg)                 |
| UX-04 / P2    | Responsive overflow in the narrow header and long-SKU adjustment form | [desktop-orders-reflow-320.jpg](images/desktop-orders-reflow-320.jpg)               |
| UX-05 / P3    | Order facts show internal IDs instead of business names               | [desktop-draft-persisted.jpg](images/desktop-draft-persisted.jpg)                   |
| UX-06 / P2    | Successful integration retry does not link to its created order       | [desktop-integration-retry-result.jpg](images/desktop-integration-retry-result.jpg) |

### UX-01 — Low-contrast role label on More

The 12px Demo workspace label renders #9eacb9 on white, contrast 2.31:1. Axe reports serious color-contrast on desktop and mobile.

Source: apps/web/app/styles/workspace/shell.css:285 at revision 4b97984. Next action: Scope the light label color to the navy header; preserve a sufficient text contrast on the white More surface. Re-run both More views.

### UX-02 — Source Sans 3 is not the rendered font

Both heading and body use the system font stack. The --font-sans computed value is empty, while --font-source-sans exists on body.

Source: apps/web/app/styles/foundation.css:133; apps/web/app/layout.tsx:42 at revision 4b97984. Next action: Resolve the next/font variable and the semantic font token at the same scope. Verify the actual computed heading/body font on production, rather than only checking the font source file.

### UX-03 — Owner settings has no visible desktop navigation entry

For an authenticated Owner at desktop size, visible navigation contains neither /app/settings nor /app/more. Settings works when its URL is entered directly; mobile reaches it through More.

Source: apps/web/components/app/workspace-navigation.tsx:211 at revision 4b97984. Next action: Expose a discoverable Owner settings entry in the desktop shell, without weakening server-side access checks.

### UX-04 — Responsive overflow in the narrow header and long-SKU adjustment form

At requested/client width 320px, document scroll width is 353px in desktop and touch contexts. At 390px the Manager header truncates workspace identity to H... . The 390px adjustment dialog also lets valid long-SKU form controls extend to x=503.78, beyond its x=390 boundary; drawer-body clientWidth=389 and scrollWidth=503.

Source: apps/web/app/styles/workspace/responsive.css:29; apps/web/app/styles/workspace/responsive.css:64; apps/web/app/styles/workspace/primitives.css:745 at revision 4b97984. Next action: Rebalance the narrow header while preserving workspace identity, and constrain form grid/select intrinsic widths. Verify both 320px page reflow and valid long SKUs inside the 390px drawer. Compare scrollWidth against clientWidth, not mobile innerWidth alone.

### UX-05 — Order facts show internal IDs instead of business names

Warehouse and Created by display UUID strings. They provide little operational meaning beside a customer/order record.

Source: apps/web/features/orders/components/order-detail-view.tsx:120 at revision 4b97984. Next action: Return the actual tenant-scoped warehouse name and creator display name. Keep IDs only in an optional technical/copy affordance; do not substitute the current viewer for the actual creator.

### UX-06 — Successful integration retry does not link to its created order

The live manual retry succeeds and its API response contains orderId, but the succeeded delivery drawer shows metadata/payload without an Open order action.

Source: apps/web/features/integrations/integrations-workspace.tsx:210 at revision 4b97984. Next action: Connect the succeeded delivery to the created order's canonical detail URL and preserve a return path to the delivery.

For UX-01, [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) specifies 4.5:1 for normal text. The measured 12px label is 2.31:1. An axe pass is not a full WCAG conformance claim. The [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informed the tested keyboard behavior: 12 Tab presses stayed inside the Draft drawer, Escape closed it and focus returned to New draft on both viewports. Audit detail Escape also passed.

The font diagnosis combines computed styles and source inspection: the root alias references a variable bound on body; that scope mismatch is consistent with the measured empty alias/system fallback. Verify the rendered font after a fix, not just the font file. At 320px, scrollWidth=353 and clientWidth=320; mobile innerWidth expanded to 353 and would conceal the defect if used as the only assertion.

## Visual assessment

The cool light/navy palette, ruled worklist, labeled status badges, dense desktop tables and mobile cards form a coherent enterprise structure. The primary workflows are usable and the tested drawer keyboard behavior is considered. The evidence calls for scoped refinements: restore the intended font, fix contrast/reflow, expose Owner settings, replace raw IDs with business names and link integration success to its order. It does not justify another wholesale visual redesign.

## Synthetic data written

| Device  | Kind            | Identifier                           | Number / SKU / resulting order       |
| ------- | --------------- | ------------------------------------ | ------------------------------------ |
| desktop | Receipt         | fe9fb699-a887-4321-b1a2-6849dc0c9669 | QA-DESKTOP-1792384976589             |
| desktop | Fulfilled order | 60bf4678-218c-4870-b08a-9a84cfc0db97 | SO-1792384991942-a1217472            |
| mobile  | Receipt         | 5de0de36-caed-49f9-bd3d-0fe9ce98ebdd | QA-MOBILE-1792385145179              |
| mobile  | Fulfilled order | 63ffeda2-58b4-4e36-8e1a-fd60b4113451 | SO-1792385161587-48745480            |
| desktop | CSV import      | d503357d-34db-4bdf-99e5-725bec7f256b | QA-IMP-DESKTOP-1792385251901         |
| desktop | Manual retry    | a301eaa2-4837-51ae-86b9-1cd1a3fb6761 | c44e89fc-f5d0-4a4d-8f9f-5012f00f4383 |
| mobile  | CSV import      | ab92ca3c-c5ce-4f55-a4ab-8c5fa61c8260 | QA-IMP-MOBILE-1792385305115          |

Both receipt/order flows used HP-1001: receipt +1, confirmation reserved 1, then Staff fulfillment -1. Each asserted one receipt movement and one sale movement, ending at on-hand 20 / reserved 4 / available 16. Draft quantity was edited from 2 to 1 and persisted across reload; URL search/status/detail survived Back/Forward. CSV committed one synthetic product per device and its SKU was verified in the downloaded catalog. Two invalid previews also left validation-run records.

Manual retry changed the seeded delivery from Failed to Succeeded and created a separate storefront Draft. That failed-worklist item is no longer present until the normal demo lifecycle restores it. No workspace reset was performed.

The mobile recovery probe used QA-IMP-MOBILE-1792385305115: +3 inbound, same-key/payload retry after response loss and reload, exactly one inbound movement, then -3 outbound. Final on-hand/reserved/available are 0/0/0, with one inbound and one outbound movement. History remains. Records were not deleted or purged and remain under the normal demo lifecycle.

## Limits and interpretation

- This is synthetic production QA, not X3 participant testing, a hiring guarantee, a load test or a security audit.
- Mobile is Chromium touch emulation, not a physical device or Safari test. 550px is a reflow probe, not native browser 200% zoom evidence. Screen readers were not exercised.
- Real-account password login/signup completion, invitations send/accept/revoke, Stripe checkout/portal, background queue workers, Cloudinary uploads and every catalog/partner CRUD variant were not exercised. Form/list/settings surfaces were captured where available. Billing changes are disabled in the shared demo.
- Resource/JS byte observations can include warm-cache behavior; they are not Core Web Vitals, TTI or cold-load bundle budgets.
- Harness corrections were not product failures: Inventory heading, hidden responsive text, waiting for the Save callback before reload, Work email label and stock trace being an inline article. They did not repeat committed business writes. Diagnostics remain in features.json/recovery.json and ignored local logs.
- Local probes/logs remain in ignored test-results/live-production-20261019/. Do not blindly re-run mutating probes: the listed operations already committed. The existing full E2E suite includes reset/onboarding and must not be pointed unchanged at production.

## Continue from this evidence

1. Review the six OPEN findings, gallery and measured JSON before editing source.
2. Address font/contrast/header/navigation, then business-name and integration-order affordances, while retaining the proven role/transaction/recovery behavior.
3. Re-test affected states on the new exact revision. Do not relabel these images as evidence of a later fix.
4. Continue X3 with real participants using [the validation sheet](https://github.com/longhang2004/StockPilot/blob/4b97984b3edd387ad29d9be5b64e3f695e602556/docs/demo-validation-sheet.md).

Unreferenced harness-failure screenshots were moved into the ignored diagnostic directory; only cited states appear in the gallery. The primary screenshot files are untouched originals.
