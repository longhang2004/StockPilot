# StockPilot Design System Master

> Source of truth for StockPilot's visual design and interaction rules. Page-specific notes may add context but must retain this contract.

**Project:** StockPilot
**Updated:** 2026-10-18
**Direction:** enterprise-clear, SAP Fiori-informed operations workspace
**Design dials:** Decoration 1/10 · Motion 1/10 · Density 7/10

## Design intent

StockPilot helps wholesale operators find the next exception, process receipts and orders, and explain inventory from reservations and source documents. The interface should feel direct, precise, and dependable:

- Cool light canvas and white data surfaces, with navy used for global structure and hierarchy.
- Tables, readable labels, explicit state, and contextual actions carry the interface. Use few containers and no decorative chrome.
- Adopt SAP Fiori's worklist, list-report, and object-page patterns as workflow references. Implement with StockPilot's existing React components and native HTML controls; this is not a SAPUI5 migration.
- Preserve tenant, role, ledger, and command semantics. Visual state never implies a permission or a successful mutation that the server has not confirmed.

## Color tokens

| Role           | Token                      |     Value | Use                                                                     |
| -------------- | -------------------------- | --------: | ----------------------------------------------------------------------- |
| Canvas         | `--color-background`       | `#F3F6F8` | Main workspace background                                               |
| Surface        | `--color-surface`          | `#FFFFFF` | Tables, forms, drawers, dialogs                                         |
| Subtle surface | `--surface-subtle`         | `#E8EEF4` | Selected navigation, table header, quiet grouping                       |
| Navy           | `--color-foreground`       | `#102A43` | Primary text, headings, desktop shell                                   |
| Action         | `--color-accent`           | `#1769AA` | Primary actions, links, selected navigation, focus ring                 |
| Secondary text | `--color-muted-foreground` | `#526272` | Supporting labels and metadata                                          |
| Control border | `--color-border-strong`    | `#7D8C9B` | Input/control boundaries and essential dividers                         |
| Row rule       | `--line-subtle`            | `#CDD6DF` | Table row separators and nonessential rules                             |
| Disabled text  | `--color-disabled`         | `#647789` | Disabled labels on `#E8EEF4`; disabled controls remain visibly inactive |
| Success        | `--color-success`          | `#20734A` | Confirmed/received/succeeded states                                     |
| Success tint   | `--surface-success`        | `#E7F4EC` | Low-emphasis success background                                         |
| Warning        | `--color-warning`          | `#8C5C00` | Draft/pending/attention states                                          |
| Warning tint   | `--surface-warning`        | `#FFF7E0` | Low-emphasis warning background                                         |
| Danger         | `--color-danger`           | `#B42318` | Failed/cancelled/low-stock error states                                 |
| Danger tint    | `--surface-danger`         | `#FDECEA` | Low-emphasis error background                                           |

Contrast ratios calculated with the WCAG relative-luminance formula for these text pairs: navy on white **14.64:1**; secondary text on white **6.27:1**; action blue on white **5.77:1** and on canvas **5.32:1**; white on navy **14.64:1**; success on white **5.81:1** and success on success tint **5.13:1**; warning on white **5.76:1** and warning on warning tint **5.38:1**; danger on white **6.57:1** and danger on danger tint **5.75:1**; disabled text on subtle surface **3.96:1**. These meet 4.5:1 for normal text, except disabled text is intentionally inactive and still exceeds 3:1. Action blue is the focus indicator; its listed contrast exceeds 3:1 against both white and canvas. The strong control border `#7D8C9B` on white is **3.44:1**. Ratios are pair-specific: check any new color/background combination before using it.

Status color must always be paired with a word, icon, or both; never rely on color alone. Keep the listed business semantics distinct: order lifecycle (Draft, Confirmed, Fulfilled, Cancelled), integration delivery (Received, Processing, Succeeded, Failed), inventory alert (Open, Resolved), and product/partner lifecycle (Active, Inactive). Do not use red/green as general brand colors.

## Typography

- **Interface family:** self-host **Source Sans 3** from Adobe's official release at `https://github.com/adobe-fonts/source-sans/tree/release/WOFF2` (or its variable-font release). Use regular 400, semibold 600, and bold 700, or one variable WOFF2. No runtime font request to Google Fonts or another third party.
- Retain Adobe's [SIL Open Font License 1.1](https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md) alongside the bundled files under `apps/web/app/fonts/`. Record provenance in the font directory. If font software is modified, comply with the OFL reserved-font-name terms. Do not redistribute the font without its license notice.
- Use `font-variant-numeric: tabular-nums` for quantity, currency, dates, and identifiers where columns need stable alignment. Verify the bundled face renders the feature in the browser before treating it as confirmed.
- Type roles: page title 28/36, section title 20/26, body 14/20, table/body compact 14/20, supporting metadata 12/16, buttons/field labels 14/20 semibold. Use 16/24 for mobile form body/help text where it improves readability. Keep headings sentence case and content left aligned.
- Do not use a second display family, oversized marketing type inside authenticated pages, or monospace as general interface typography. Use a system monospace fallback only for content whose meaning requires code-like formatting.

## Layout, density, shape, and motion

- Use a 4px base spacing grid, with 8px as the common control/gap increment and 16/24/32px section rhythm.
- Controls use 2–4px corners. Data workspace surfaces are square or nearly square; reserve modest rounding for dialogs and overlays. Avoid pill-shaped controls except short status markers where they remain compact.
- Target desktop table rows around 44px, with clear horizontal rules. Align quantities and currency to the right; align names, references, and statuses to the left. Keep one logical table toolbar with title/count and related actions.
- Use hairlines, spacing, and type scale for page hierarchy. Shadows are limited to menus, dialogs, drawers, and other overlays. No card grid as the default container for operational data.
- Motion is functional only: 120–200ms color/opacity feedback, no page entrance choreography or layout movement. Respect `prefers-reduced-motion` and keep feedback clear with motion disabled.
- Keep content operable at 200% zoom and at narrow widths. Do not hide core operations behind hover; all actions work by keyboard and touch.

## App shell and page patterns

### Global shell

- **Desktop:** use a navy global structure with a clear organization/session area and grouped functional navigation; keep the main data workspace white/light and visually distinct. Show current location with a restrained blue active indicator, text, and accessible selected state.
- **Mobile:** show four labeled primary destinations—Overview, Orders, Inventory, and More—with at least 44×44px touch targets and safe-area padding. Put secondary routes under More. Prioritize identity, status, and next action in record views; no page-level horizontal overflow.
- Navigation labels and icons stay consistent across routes. Use one icon family and visibly label icon-only actions for assistive technology.

### Worklist and list report

- **Overview:** make the operational queue the primary content. Put approvals, low-stock exceptions, failed integrations, and recent work in a prioritized worklist with clear next actions. Analytics and summary values are supporting context, not a wall of KPI cards.
- **Orders, catalog/partners, and inventory:** use list-report hierarchy: page title/actions, search and useful filters, one dominant data table, count, and row navigation. Keep common filters visible in the filter region. Search and filters must have persistent labels and preserve their state in the URL when already supported by the route.
- **Approvals and integration failures:** use focused worklists for “find next item and act.” Show queue title/count, table search, status, and selection-dependent actions. Keep secondary actions in an overflow menu; keep the main action visible.
- Put bulk actions in context when rows are selected. Disable irrelevant actions with an explanation where useful. Show active filters and selected-row count. Loading, empty, error, stale, and success states must be explicit and preserve retry/recovery paths.
- On mobile, show the identifying fields, lifecycle state, and next action first. Present secondary fields in a compact detail area. Never shrink a wide desktop table until text is unreadable.

### Object page and task forms

- A selected order, receipt, product/SKU, or partner uses a contextual object header with name/reference, lifecycle state, key values, breadcrumbs when useful, and global actions.
- Organize details into concise labeled sections: core facts, line items, movement/reservation history, source documents, and audit context as applicable. Add anchor navigation only when several substantial sections need direct access; simple objects use a flat page.
- Display-mode global actions belong with the object header. Create/edit dialogs or pages use a clear form hierarchy, persistent field labels, inline errors, and explicit Save/Cancel placement. Preserve focus on open, constrain focus in a modal, and restore focus on close.
- Receipt documents and stock movements are different objects. A receipt page summarizes its supplier/reference and all lines; movement history records ledger events. Reservations are a separate derived view of confirmed order quantities, never a fabricated movement.
- After a command, show confirmed success only after the server confirms it. On unknown outcome, preserve the command reference and offer safe status recovery/retry behavior; do not tell users to repeat a non-idempotent action blindly.

### Public and authentication pages

- Landing page uses a concise product introduction, concrete task descriptions, current product evidence, and immediate Manager/Staff/Owner demo entry. Avoid oversized hero claims or decorative landing-page sections that obscure the application.
- Login, signup, workspace creation, and invitation acceptance are focused forms with clear labels, validation, and recovery links. Keep visual tokens consistent with the app while allowing more whitespace than the dense operations workspace.
- Refresh favicon, app icons, social previews, and browser theme metadata to match the new cool-light/navy system; do not feature obsolete screenshots as proof of the redesigned UI.

## Interaction states and accessibility

- Define distinct default, hover, active, focus-visible, selected, disabled, pending/loading, success, warning, and error states for controls, rows, navigation, and dialogs.
- Focus is always visible: use a 2px action-blue outline with 2px offset on white/canvas controls. Do not remove browser focus without an equally visible replacement.
- Use semantic buttons, links, forms, table headers, and dialog roles. Tab order follows visible reading order. Icon-only controls have accessible names and keyboard operation.
- Keep loading and unknown outcomes distinguishable from failure and confirmed success. Give inline validation beside its field and a summary when the form has multiple errors.
- Support reduced motion, text zoom, keyboard-only use, screen readers, and touch. Color is never the sole carrier of status or selection.

## Anti-patterns

Do not reintroduce warm bone surfaces, terracotta brand accents, IBM Plex, or the previous soft dashboard aesthetic. Avoid repeated rounded-card compositions, card grids for table data, oversized metric tiles, gradients, glass effects, ornamental animation, heavy shadows, excessive pills, decorative labels/eyebrows, low-contrast gray text, hover-only actions, color-only status, or mobile horizontal overflow. Do not mix SAP and Fluent visual components; use the selected SAP-inspired workflow structure with the project's native components.
