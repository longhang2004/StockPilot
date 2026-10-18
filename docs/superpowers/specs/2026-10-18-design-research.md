# StockPilot redesign research — 2026-10-18

## Locked direction

Use **enterprise-clear, SAP Fiori-informed operations UI**: cool, bright surfaces; navy structure; restrained blue action color; minimal decoration; data and workflow states carry the page. This follows the user's selected direction. Borrow SAP's page and workflow patterns, while implementing them with StockPilot's existing Next.js/React components and CSS. There is no need to migrate to SAPUI5 or Fluent UI.

This is a wholesale visual reset from the current visual contract in [`design-system/stockpilot/MASTER.md`](../../../design-system/stockpilot/MASTER.md): bone canvas `#F2F0EA`, terracotta accent `#B34718`, IBM Plex Sans/Mono, rounded surfaces, and dashboard/stat-card treatment. Preserve business meaning and mobile/touch support while replacing that visual language.

## Proposed visual foundation

The colors below are a concrete starting proposal for the new direction, not values copied from SAP; check text and component contrast before implementation is finalized.

| Role           | Proposed value                                               | Use                                                       |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Canvas         | `#F3F6F8`                                                    | Cool light page background                                |
| Surface        | `#FFFFFF`                                                    | Tables, forms, drawers                                    |
| Primary ink    | `#102A43`                                                    | App shell, headings, primary text                         |
| Action blue    | `#1769AA`                                                    | Primary action, links, current navigation                 |
| Secondary text | `#526272`                                                    | Supporting labels and metadata                            |
| Divider        | `#CDD6DF`                                                    | Table rules and control borders                           |
| Status         | Keep distinct semantic green / amber / red, with text labels | Success, attention, error; color is never the only signal |

Use **Source Sans 3** as the sole interface family (regular, semibold, bold); use its official WOFF2 release and self-host it under `apps/web/app/fonts/`, retaining Adobe's OFL license file. Adobe describes Source Sans 3 as designed for UI environments and its repository provides WOFF2 and variable-font CSS. It is a strong candidate to replace IBM Plex without introducing a decorative display face. Start from Fluent's semantic type-ramp principle: body 14/20 or 16/24, section title 20/26, page title 28–32/36–40; sentence case and left alignment. Keep SKU, quantity, currency, and order IDs easy to scan; verify `tabular-nums` with the chosen font in browser before relying on it. [Adobe Source Sans 3 repository](https://github.com/adobe-fonts/source-sans) · [OFL 1.1 license](https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md) · [Fluent 2 typography](https://fluent2.microsoft.design/typography)

## Patterns to carry into StockPilot

- **List report for broad data finding:** use on inventory, catalog, partners, and audit-style records where users compare, filter, sort, or select many objects. Page hierarchy: title and page-level actions; a clear search/filter region; one dominant table; table title/count; row-level navigation. SAP describes this as the entry point for finding and acting on objects, with details opening on an object page. Keep search and filters together in the filter region when they are primary tasks.
- **Worklist for a focused queue:** use on orders, approvals, failed deliveries, and other “find next item and act” workflows. Start with one task title, count, table, and table-toolbar search; show selection-dependent actions only when selection exists. SAP's worklist is a simplified list report without a filter bar, with search in the table toolbar. Do not add an elaborate filter bar to a short queue by default.
- **Object page for one record:** product, order, partner, or receipt detail gets a contextual header (name/ID, lifecycle state, key values, global actions) then labeled sections for core facts, line items/history, and audit context. Use anchor navigation only when several substantive sections need direct access; a simple object can be one flat page. In display mode, put global actions in the header. In edit/create mode, put Save/Cancel in a persistent footer. This maps to existing StockPilot routes and workflows without adopting SAP controls.
- **Table behavior:** keep rows and columns as the primary information structure; use one toolbar above its table for table actions and a visible item count. Place common filters in the page filter region rather than hiding them in table settings. Keep create/add visible if it is the main action; put secondary actions in overflow. Show active filters and selection counts. On narrow screens prioritize identity, status, and the next action; collapse lower-priority fields into a detail disclosure/record view instead of making the whole app scroll horizontally.
- **Restraint:** use plain surfaces, clear rules, spacing, and typographic hierarchy. Reserve bordered containers for actual groups/forms, not every section. Avoid floating-card dashboards, decorative gradients, excessive pills, giant KPI tiles, random shadows, and accent-colored text for ordinary metadata.

## Official documentation consulted

1. [SAP Fiori list report floorplan](https://experience.sap.com/fiori-design-web/v1-46/list-report-floorplan-sap-fiori-element/) — **Intro, Usage, Structure, Header Title**: when to use list report, page regions, filter region, one table/chart toolbar, object-page navigation.
2. [SAP Fiori worklist](https://experience.sap.com/fiori-design-web/worklist-sap-fiori-elements/) — **Intro, Worklist-Specific Features**: simplified list report, no filter bar, search in table toolbar, row count, personalization.
3. [SAP Fiori object page floorplan](https://experience.sap.com/fiori-design-web/object-page/) — **Components, Dynamic Page Header, Breadcrumbs, Header Content**; together with [Object Page – Content Area](https://experience.sap.com/fiori-design-web/object-page-content-area-sap-fiori-elements/) — **Navigation Bar, Sections and Subsections**. Evidence for contextual record header, optional anchor navigation, section structure.
4. [SAP Fiori table toolbar](https://experience.sap.com/fiori-design-web/explore_group/toolbar/) — **Table Toolbar, Create/Add, Sort/Filter/Group**: contextual action placement, keep main action visible, do not duplicate primary filtering in table toolbar.
5. [SAP Fiori table overview](https://experience.sap.com/fiori-design-web/table-overview/) — **Intro, Usage**; and [responsive table toolbar](https://experience.sap.com/fiori-design-web/tables-toolbar/) — **Show/Hide Details**: choose responsive table for moderate data and adapt detail/column visibility.
6. [Microsoft Fluent 2 typography](https://fluent2.microsoft.design/typography) — **Fluent font stacks, Type ramp, Styling text**: semantic type roles, type sizes, sentence case, alignment, contrast minimums. Used as supporting typography guidance, not a second visual system.
7. [Adobe Source Sans 3](https://github.com/adobe-fonts/source-sans) — repository overview lists UI purpose and `WOFF2`, `VF`, and CSS files; [license](https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md) — **SIL Open Font License 1.1** allows use, embedding, bundling, and redistribution with the license notice. Obtain files from official `release/WOFF2` or `release/VF`; self-host, retain license, and avoid modifying font files unless handling OFL reserved-name requirements.

## Resume pointers and gaps

Useful local implementation references: [`design-system/stockpilot/MASTER.md`](../../../design-system/stockpilot/MASTER.md), [`apps/web/app/app/[section]/page.tsx`](../../../apps/web/app/app/%5Bsection%5D/page.tsx), [`apps/web/app/styles/workspace/`](../../../apps/web/app/styles/workspace/), and [`apps/web/app/fonts/`](../../../apps/web/app/fonts/). Current sections include overview, inventory, orders, catalog/partners, and integrations; see `README.md`'s “Core workflows” for receive → confirm → fulfill and exception-handling flows.

Evidence supports the page patterns and Source Sans 3's UI intent and license. The exact palette, type sizes, responsive field priority, and mapping from each route to list report/worklist/object page are design proposals for this product; validate them against actual pages and seeded data. The SAP pages describe SAP floorplans, not StockPilot-specific components, and Fluent is cited only for typography/accessibility principles. Contrast ratios and Source Sans 3 tabular numeral behavior have not been computed/tested here.
