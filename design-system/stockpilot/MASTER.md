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
- High-density operations tables use tabular numerals, right-aligned monetary/quantity values, and 40–44px row heights.
- Desktop features an integrated ink sidebar and docked horizontal statistic strips with vertical hairline dividers (no floating card soup).
- Mobile features sticky bottom navigation with safe-area padding and single-column touch-friendly records (>= 44px touch targets).

## Token contract

Tokens follow three layers: primitives hold values, semantic tokens assign meaning, and component tokens define local behavior. Feature components must consume semantic/component tokens rather than hardcoded colors.

### Core colors

| Role         | Token                      | Value     | Contrast / Purpose                           |
| ------------ | -------------------------- | --------- | -------------------------------------------- |
| Canvas       | `--color-background`       | `#F2F0EA` | Neutral bone off-white background            |
| Surface      | `--color-surface`          | `#FCFBF7` | Paper white container surface                |
| Surface Alt  | `--surface-subtle`         | `#EAE7DE` | Subtle background tone for headers/tags      |
| Ink          | `--color-foreground`       | `#17201F` | Deep slate ink for typography                |
| Muted text   | `--color-muted-foreground` | `#5D6562` | Secondary labels and metadata                |
| Divider      | `--color-border`           | `#D9D6CE` | 1px hairlines for table and card borders     |
| Divider Thin | `--line-subtle`            | `#E5E2DA` | 1px internal row hairlines                   |
| Accent       | `--color-accent`           | `#B34718` | Quiet terracotta (WCAG 2 AA >4.8:1 contrast) |
| Success      | `--color-success`          | `#2D6B4F` | Inbound receipts, confirmed status           |
| Warning      | `--color-warning`          | `#A7701E` | Draft orders, pending items                  |
| Danger       | `--color-danger`           | `#B34638` | Low stock exceptions, cancelled/failed       |

### Typography

- Inter is the interface family; JetBrains Mono / IBM Plex Mono is used for SKU, order numbers, quantities, timestamps, and currency with tabular numerals (`.mono`).
- Type scale: `10px` (`--text-2xs`), `11px` (`--text-xs`), `13px` (`--text-sm`), `15px` (`--text-md`), `18px` (`--text-lg`), `22px` (`--text-xl`), `28px` (`--text-2xl`).

### Spacing, Shape, and Motion

- Spacing grid: 4px base (`0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.25rem`, `1.5rem`).
- Border Radii: `4px` (`--radius-xs` for controls/tags), `6px` (`--radius-sm` for buttons/inputs), `8px` (`--radius-md` for cards/tables), `10px` (`--radius-lg` for panels/drawers).
- Control Heights:
  - Desktop: 40–44px table rows; 38–40px search/filter controls and buttons.
  - Mobile: >= 44px touch targets for buttons, selectors, and bottom navigation.
- Motion: 150–220ms limited to `opacity` and `background-color`. Respect `prefers-reduced-motion: reduce`.
- Shadows: low, restrained shadows (`--shadow-sm`, `--shadow-md`) on panels and modal overlays; data surfaces use hairlines and spacing for hierarchy.

### Status Semantics

Status keys represent distinct business domains and must not be overloaded:

- **Lifecycle (Products, Partners)**: `ACTIVE` ("Active"), `INACTIVE` ("Inactive")
- **Integration Deliveries**: `SUCCEEDED` ("Succeeded"), `FAILED` ("Failed")
- **Orders**: `DRAFT` ("Draft"), `CONFIRMED` ("Confirmed"), `FULFILLED` ("Fulfilled"), `CANCELLED` ("Cancelled")
- **Inventory Alerts**: `OPEN` ("Open"), `RESOLVED` ("Resolved")
- **Stock Ledger Movements**: `RECEIPT` ("Receipt"), `SALE` ("Sale"), `ADJUSTMENT_IN` ("Adjustment in"), `ADJUSTMENT_OUT` ("Adjustment out")

## Layout and Responsive Behavior

- Tested & validated at 390px (mobile), 768px (tablet), 1024px (laptop), and 1440px (desktop).
- Desktop uses a fixed 228px ink sidebar with integrated organization header and active terracotta indicators.
- At 768px and below, hide the sidebar, render primary data as flat record cards, and display sticky bottom navigation with safe-area insets.
- Zero horizontal overflow on mobile viewports.
