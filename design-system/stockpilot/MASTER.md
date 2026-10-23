# StockPilot Design System Master

> Source of truth for StockPilot's visual design and interaction rules. Page-specific notes may add context but must retain this contract.

**Project:** StockPilot
**Updated:** 2026-10-23
**Direction:** Atlas v2 — approved for the official application after prototype and implementation review.
**Design dials:** Decoration 2/10 · Workspace motion 1/10 · Density 6/10

Atlas replaces the 18 October navy/blue direction. The implementation and evidence are recorded in [Atlas v2](../../docs/design-v2/IMPLEMENTATION.md); earlier prototypes remain historical references.

## Design intent

StockPilot helps wholesale operators find the next exception, process receipts and orders, and explain inventory from reservations and source documents. The interface should feel direct, precise, and dependable:

- Warm neutral canvas, white data surfaces and evergreen actions. Use a labeled desktop sidebar and a quiet header, keeping the primary task visually dominant.
- Tables, readable labels, explicit state, and contextual actions carry the interface. Use few containers and no decorative chrome.
- Use worklists, searchable registers and contextual detail drawers with StockPilot's existing React components and native HTML controls. Keep the visible workflow connected to API records and source documents.
- Preserve tenant, role, ledger, and command semantics. Visual state never implies a permission or a successful mutation that the server has not confirmed.

## Color tokens

| Role           | Token                      |     Value | Use                                                        |
| -------------- | -------------------------- | --------: | ---------------------------------------------------------- |
| Canvas         | `--color-background`       | `#F6F7F5` | Main workspace background                                  |
| Surface        | `--color-surface`          | `#FFFFFF` | Tables, forms, drawers, dialogs                            |
| Subtle surface | `--surface-subtle`         | `#F0F3EF` | Table header and quiet grouping                            |
| Primary text   | `--color-foreground`       | `#1E2923` | Primary text and headings                                  |
| Action         | `--color-accent`           | `#225D43` | Primary actions, links and focus ring                      |
| Selected tint  | `--color-accent-subtle`    | `#E6EEE7` | Selected navigation                                        |
| Secondary text | `--color-muted-foreground` | `#5F6D64` | Supporting labels and metadata                             |
| Control border | `--color-border-strong`    | `#8A978E` | Input/control boundaries and essential dividers            |
| Row rule       | `--line-subtle`            | `#DCE2DC` | Table row separators and nonessential rules                |
| Disabled text  | `--color-disabled`         | `#647789` | Disabled labels; disabled controls remain visibly inactive |
| Success        | `--color-success`          | `#20734A` | Confirmed/received/succeeded states                        |
| Success tint   | `--surface-success`        | `#E7F4EC` | Low-emphasis success background                            |
| Warning        | `--color-warning`          | `#8C5C00` | Draft/pending/attention states                             |
| Warning tint   | `--surface-warning`        | `#FFF7E0` | Low-emphasis warning background                            |
| Danger         | `--color-danger`           | `#B42318` | Failed/cancelled/low-stock error states                    |
| Danger tint    | `--surface-danger`         | `#FDECEA` | Low-emphasis error background                              |

Check contrast for the actual text/background pair whenever adding a color. Normal text requires at least 4.5:1, large text and focus/control boundaries at least 3:1 where WCAG applies. Recorded Atlas axe checks cover desktop/mobile pages and key overlays; they do not establish complete accessibility conformance.

Status color must always be paired with a word, icon, or both; never rely on color alone. Keep the listed business semantics distinct: order lifecycle (Draft, Confirmed, Fulfilled, Cancelled), integration delivery (Received, Processing, Succeeded, Failed), inventory alert (Open, Resolved), and product/partner lifecycle (Active, Inactive). Evergreen is also the brand action color, so a green action never implies that a command has already succeeded.

## Typography

- **Interface family:** self-host **Source Sans 3** from Adobe's official release at `https://github.com/adobe-fonts/source-sans/tree/release/WOFF2` (or its variable-font release). Use regular 400, semibold 600, and bold 700, or one variable WOFF2. No runtime font request to Google Fonts or another third party.
- Retain Adobe's [SIL Open Font License 1.1](https://github.com/adobe-fonts/source-sans/blob/release/LICENSE.md) alongside the bundled files under `apps/web/app/fonts/`. Record provenance in the font directory. If font software is modified, comply with the OFL reserved-font-name terms. Do not redistribute the font without its license notice.
- Use `font-variant-numeric: tabular-nums` for quantity, currency, dates, and identifiers where columns need stable alignment. Verify the bundled face renders the feature in the browser before treating it as confirmed.
- Type roles: page title 28/36, section title 20/26, body 14/20, table/body compact 14/20, supporting metadata 12/16, buttons/field labels 14/20 semibold. Use 16/24 for mobile form body/help text where it improves readability. Keep headings sentence case and content left aligned.
- Do not use a second display family, oversized marketing type inside authenticated pages, or monospace as general interface typography. Use a system monospace fallback only for content whose meaning requires code-like formatting.

## Layout, density, shape, and motion

- Use a 4px base spacing grid, with 8px as the common control/gap increment and 16/24/32px section rhythm.
- Use the existing 4/6/8/12px radius tokens. Keep data rows structured and controls compact; reserve pills for short status markers.
- Target desktop table rows around 44px, with clear horizontal rules. Align quantities and currency to the right; align names, references, and statuses to the left. Keep one logical table toolbar with title/count and related actions.
- Use hairlines, spacing, and type scale for page hierarchy. Shadows are limited to menus, dialogs, drawers, and other overlays. No card grid as the default container for operational data.
- Workspace motion is functional: 120–200ms color/opacity feedback. The public hero may use the approved logistics canvas beneath its content, with pause/play, reduced-motion support and suspension while hidden/offscreen. Keep marketing motion outside operational tables and task forms.
- Keep content operable at 200% zoom and at narrow widths. Do not hide core operations behind hover; all actions work by keyboard and touch.

## App shell and page patterns

### Global shell

- **Desktop:** use a 224px labeled sidebar grouped into Operations and Workspace, with a quiet 70px header for organization, search and session controls. Show current location with an evergreen active tint and accessible selected state. Settings is available to Owners.
- **Mobile:** show five labeled destinations—Overview, Orders, Inventory, Receipts and More—with at least 44×44px touch targets and safe-area padding. Put secondary routes under More. Prioritize identity, status, line items and next action; no page-level horizontal overflow.
- Global search opens with Ctrl/Command + K, searches server records and supports Enter/Escape. Do not replace real results with a decorative command menu.
- Navigation labels and icons stay consistent across routes. Use one icon family and visibly label icon-only actions for assistive technology.

### Worklist and list report

- **Overview:** make the operational queue the primary content. Put approvals, low-stock exceptions, failed integrations, and recent work in a prioritized worklist with clear next actions. Analytics and summary values are supporting context, not a wall of KPI cards.
- **Orders, catalog/partners, and inventory:** use list-report hierarchy: page title/actions, search and useful filters, one dominant data table, count, and row navigation. Keep common filters visible in the filter region. Search and filters must have persistent labels and preserve their state in the URL when already supported by the route.
- **Approvals and integration failures:** use focused worklists for “find next item and act.” Show queue title/count, table search, status, and selection-dependent actions. Keep secondary actions in an overflow menu; keep the main action visible.
- Put bulk actions in context when rows are selected. Disable irrelevant actions with an explanation where useful. Show active filters and selected-row count. Loading, empty, error, stale, and success states must be explicit and preserve retry/recovery paths.
- On mobile, show the identifying fields, lifecycle state, and next action first. Present secondary fields in a compact detail area. Never shrink a wide desktop table until text is unreadable.

### Object page and task forms

- Orders and SKU traces use contextual drawers over their register. Receipts use a linked document page. Preserve URL/deep-link state and a clear return path to the underlying list.
- Organize details into concise labeled sections: core facts, line items, movement/reservation history, source documents, and audit context as applicable. Add anchor navigation only when several substantial sections need direct access; simple objects use a flat page.
- Drawer headers and action footers remain outside the scrolling body. Put order lines before secondary contact/technical facts; use readable line cards on mobile. Create/edit forms retain multiple lines, persistent labels, validation and Save/Cancel placement. Preserve focus on open, constrain focus in a modal, and restore focus on close.
- Confirm/fulfill actions first show on-hand, reserved and available quantities before/after. Insufficient stock blocks confirmation; the server rechecks balances atomically when the command is submitted. `available = onHand - reserved` remains authoritative.
- Receipt documents and stock movements are different objects. A receipt page summarizes its supplier/reference and all lines; movement history records ledger events. Reservations are a separate derived view of confirmed order quantities, never a fabricated movement.
- After a command, show confirmed success only after the server confirms it. On unknown outcome, preserve the command reference and offer safe status recovery/retry behavior; do not tell users to repeat a non-idempotent action blindly.

### Public and authentication pages

- Landing page uses a concise product introduction, concrete task descriptions, current product evidence, and immediate Manager/Staff/Owner demo entry. Avoid oversized hero claims or decorative landing-page sections that obscure the application.
- Login, signup, workspace creation, and invitation acceptance are focused forms with clear labels, validation, and recovery links. Keep visual tokens consistent with the app while allowing more whitespace than the dense operations workspace.
- Favicon, app icons, social previews and browser theme metadata use Atlas. Product tour screenshots come from the implemented application and use Next's image assets; historical prototype imagery is not current product evidence.

## Interaction states and accessibility

- Define distinct default, hover, active, focus-visible, selected, disabled, pending/loading, success, warning, and error states for controls, rows, navigation, and dialogs.
- Focus is always visible: use a 2px evergreen outline with 2px offset on white/canvas controls. Do not remove browser focus without an equally visible replacement.
- Use semantic buttons, links, forms, table headers, and dialog roles. Tab order follows visible reading order. Icon-only controls have accessible names and keyboard operation.
- Keep loading and unknown outcomes distinguishable from failure and confirmed success. Give inline validation beside its field and a summary when the form has multiple errors.
- Support reduced motion, text zoom, keyboard-only use, screen readers, and touch. Color is never the sole carrier of status or selection.

## Anti-patterns

Avoid oversized metric walls, repeated decorative cards, gradients, glass effects, heavy shadows, excessive pills, low-contrast gray text, hover-only actions, color-only status and mobile horizontal overflow. Do not reintroduce the retired navy/blue or Keyly dark layout as a parallel theme. Keep one Atlas system across landing, authentication and the workspace; the approved logistics backdrop belongs on the public hero.
