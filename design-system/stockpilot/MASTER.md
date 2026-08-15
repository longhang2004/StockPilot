# StockPilot Design System Master

> Quiet-industrial operations console for a small wholesale team. This file is
> the source of truth for visual tokens and interaction rules. Page-specific
> guidance may extend these rules, but must not replace the semantic contract.

**Project:** StockPilot
**Updated:** 2026-08-15
**Direction:** quiet industrial / high-density / data-first / accessible
**Design dials:** Variance 4/10 · Motion 2/10 · Density 8/10

## Design intent

StockPilot should feel calm, precise, and ready for the next warehouse action:

- Warm neutral surfaces and dark ink console structure keep the workspace quiet and focused.
- Terracotta is the sole brand accent; emerald, ochre/amber, and rust/red are reserved for semantic status feedback.
- High-density operations tables use tabular numerals, right-aligned monetary/quantity values, and ~40px row heights.
- Desktop features an integrated 228px ink sidebar and docked horizontal statistic strips with vertical hairline dividers (no floating card soup).
- Mobile features sticky bottom navigation with safe-area padding and single-column touch-friendly records (>= 44px touch targets).

## Token contract

Tokens follow three layers: primitives hold values, semantic tokens assign meaning, and component tokens define local behavior. Feature components must consume semantic/component tokens rather than hardcoded colors.

### Core colors

| Role         | Token                      | Value     | Contrast / Purpose                                                                                                                                   |
| ------------ | -------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas       | `--color-background`       | `#F2F0EA` | Neutral bone off-white background                                                                                                                    |
| Surface      | `--color-surface`          | `#FCFBF7` | Paper white container surface                                                                                                                        |
| Surface Alt  | `--surface-subtle`         | `#EAE7DE` | Subtle background tone for headers/tags                                                                                                              |
| Ink          | `--color-foreground`       | `#17201F` | Deep slate ink for typography                                                                                                                        |
| Muted text   | `--color-muted-foreground` | `#5D6562` | Secondary labels and metadata                                                                                                                        |
| Divider      | `--color-border`           | `#D9D6CE` | 1px hairlines for table and card borders                                                                                                             |
| Divider Thin | `--line-subtle`            | `#E5E2DA` | 1px internal row hairlines                                                                                                                           |
| Accent       | `--color-accent`           | `#B34718` | Quiet terracotta for interactive accents and large/display text (4.4:1 on canvas — not AA for small text; use `--color-accent-hover` for small text) |
| Accent Deep  | `--color-accent-hover`     | `#963910` | Darker terracotta for hover states and small accent text (5.9:1 on canvas)                                                                           |
| Success      | `--color-success`          | `#2D6B4F` | Inbound receipts, confirmed status                                                                                                                   |
| Warning      | `--color-warning`          | `#A7701E` | Draft orders, pending items                                                                                                                          |
| Danger       | `--color-danger`           | `#B34638` | Low stock exceptions, cancelled/failed                                                                                                               |

### Typography

- IBM Plex Sans is the interface family; IBM Plex Mono is used for SKU, order numbers, quantities, timestamps, and currency with tabular numerals (`.mono`). Both are bundled locally via `next/font/local` in `apps/web/app/layout.tsx`.
- Token type scale: `11px` (`--text-2xs`), `12px` (`--text-xs`), `13.5px` (`--text-sm`), `15px` (`--text-md`), `18px` (`--text-lg`), `22px` (`--text-xl`), `26px` (`--text-2xl`).
- Marketing display headings are fluid: hero `h1` `clamp(2.35rem, 4.2vw, 3.5rem)`, section headings `clamp(1.85rem, 3vw, 2.5rem)` — these are page-level, not tokens.

### Spacing, Shape, and Motion

- Spacing grid: 4px base (`0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.25rem`, `1.5rem`).
- Border Radii: `4px` (`--radius-xs` for controls/tags), `6px` (`--radius-sm` for buttons/inputs), `8px` (`--radius-md` for cards/tables), `10px` (`--radius-lg` for panels/drawers), `999px` (`--radius-pill`).
- Control Heights:
  - Dense desktop mouse/keyboard controls: buttons and form fields use `min-height: 2.25rem` (36px) via `--button-min-height`; search/filter bars and table rows run ~40px. The operations console intentionally favors density over 44px desktop targets.
  - Mobile/touch: buttons in page headers, selectors, and bottom navigation grow to >= 44px touch targets (see `responsive.css`).
- Motion — two contexts:
  - **Authenticated application**: dense operations UI. Durations from tokens: `120ms` (`--motion-fast`), `160ms` (`--motion-normal`), `200ms` (`--motion-slow`). Motion is minimal — interaction/state feedback via `background-color`, `border-color`, and `color` transitions; no layout movement.
  - **Public marketing page**: restrained entrance motion only — `heroCopyFade` / `heroShotFade` animate `opacity` 0→1 with a small `translateY` (8–14px) over ~350ms; micro-interactions use `--motion-fast` (120ms) and may animate `transform`. `prefers-reduced-motion: reduce` is honored globally (`foundation.css` kill-switch) and by the hero specifically.
- Shadows: low, restrained shadows (`--shadow-sm`, `--shadow-md`, `--shadow-overlay`, `--shadow-dropdown`, `--shadow-bottom-nav`) on panels, modals, dropdowns, and bottom navigation; data surfaces use hairlines and spacing for hierarchy.

### Status Semantics

Status keys represent distinct business domains and must not be overloaded:

- **Lifecycle (Products, Partners)**: `ACTIVE` ("Active"), `INACTIVE` ("Inactive")
- **Integration Deliveries**: `RECEIVED` ("Received"), `PROCESSING` ("Processing"), `SUCCEEDED` ("Succeeded"), `FAILED` ("Failed")
- **Orders**: `DRAFT` ("Draft"), `CONFIRMED` ("Confirmed"), `FULFILLED` ("Fulfilled"), `CANCELLED` ("Cancelled")
- **Inventory Alerts**: `OPEN` ("Open"), `RESOLVED` ("Resolved")
- **Stock Ledger Movements**: `RECEIPT` ("Receipt"), `SALE` ("Sale"), `ADJUSTMENT_IN` ("Adjustment in"), `ADJUSTMENT_OUT` ("Adjustment out")

## Layout and Responsive Behavior

- Tested & validated at 390px (mobile), 768px (tablet), 1024px (laptop), and 1440px (desktop).
- Desktop uses a fixed 228px ink sidebar with integrated organization header and active terracotta indicators.
- At 768px and below, hide the sidebar, render primary data as flat record cards, and display sticky bottom navigation with safe-area insets.
- Zero horizontal overflow on mobile viewports.
