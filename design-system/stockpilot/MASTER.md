# StockPilot Design System Master

> Quiet-industrial operations console for a small wholesale team. This file is
> the source of truth for visual tokens and interaction rules. Page-specific
> guidance may extend these rules, but must not replace the semantic contract.

**Project:** StockPilot
**Updated:** 2026-08-04
**Direction:** quiet industrial / data-first / accessible
**Design dials:** Variance 3/10 · Motion 2/10 · Density 7/10

## Design intent

StockPilot should feel calm, precise, and ready for the next warehouse action:

- warm neutral surfaces and ink structure keep the workspace quiet;
- terracotta is the only visual accent; success, warning, and danger are
  reserved for semantic status feedback;
- dense tables use stable alignment, tabular numerals, and short labels;
- desktop keeps the persistent sidebar; mobile keeps the four-item bottom
  navigation and bottom-sheet interactions.

## Token contract

Tokens follow three layers: primitives hold values, semantic tokens assign
meaning, and component tokens define local behavior. Feature components must
consume semantic/component tokens rather than hardcoded colors.

### Core colors

| Role       | Token                      | Value     |
| ---------- | -------------------------- | --------- |
| Canvas     | `--color-background`       | `#F2F0EA` |
| Surface    | `--color-surface`          | `#FCFBF7` |
| Ink        | `--color-foreground`       | `#17201F` |
| Muted text | `--color-muted-foreground` | `#5D6562` |
| Divider    | `--color-border`           | `#D9D6CE` |
| Accent     | `--color-accent`           | `#C45A2A` |
| Success    | `--color-success`          | `#2F6B4F` |
| Warning    | `--color-warning`          | `#8A5A16` |
| Danger     | `--color-danger`           | `#B34B39` |

Status colors must be paired with text, an icon, or another semantic cue. The
accent is not reused to imply success or warning.

### Typography

- IBM Plex Sans is the interface family; IBM Plex Mono is used for SKU, order
  IDs, quantities, dates, and money with tabular figures.
- Both families are loaded with `next/font`; do not add runtime Google Fonts
  stylesheet imports.
- Type scale is fixed at `12 / 14 / 16 / 20 / 28 / 36 / 48px`.

### Spacing, shape, and motion

- The spacing grid is 4/8px. Use `--space-1` through `--space-10` rather than
  inventing feature-specific spacing values.
- Radius is limited to `4px`, `8px`, and `12px`; pills are status-only.
- Interactive targets are at least 44px. Focus rings use the accent token.
- Motion is 150–220ms and limited to `opacity` and `transform`. Respect
  `prefers-reduced-motion: reduce`.
- Shadows are reserved for drawers and dialogs; data surfaces use dividers and
  spacing for hierarchy.

### Component defaults

```css
.button-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  min-height: var(--button-min-height);
}

.button-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.input,
.form-field input,
.form-field select,
.form-field textarea {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--input-radius);
  min-height: var(--input-min-height);
}
```

## Layout and responsive behavior

- Validate at 375, 390, 768, 1024, and 1440px.
- Desktop uses a persistent sidebar and a readable fluid main column.
- At 768px and below, hide the sidebar, reserve safe-area space for the fixed
  four-item bottom navigation, and render primary data as ordered record cards.
- Keep one reading column on narrow screens. No horizontal page scroll and no
  content hidden under fixed navigation.

## Product and interaction boundaries

- Preserve every existing route, navigation label, form field name/order,
  permission, tenant boundary, and mutation behavior.
- Keep drawer focus trap, Escape close, focus restoration, and unsaved-change
  guard behavior intact.
- Do not add dark mode, a second icon family, decorative gradients/glows,
  repeated eyebrow labels, Unicode arrows, or card lift on hover.
- Marketing may use a checked-in product screenshot, but dashboard surfaces
  must represent real workflows rather than fabricated metric decoration.
