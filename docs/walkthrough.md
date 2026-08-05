# StockPilot two-minute walkthrough

Use the canonical production origin configured in `SITE_URL` for the public
walkthrough. Until the custom domain is attached, the temporary Vercel URL
below is the current demo origin.

**Current demo URL:** <https://stock-pilot-web-five.vercel.app>

**API docs:** <https://stockpilot-api-y1aw.onrender.com/docs>

The walkthrough is designed to show the product value before explaining the
architecture. Use the 1440px desktop viewport for the first pass and the 375px
mobile viewport for the final pass.

## Screenshot gallery

The following checked-in captures are from the current live demo origin with
the canonical fixture. They are useful for a README preview, portfolio review,
or recording storyboard; the browser chrome has been cropped out.

| Overview · desktop                                  | Orders · mobile                                  |
| --------------------------------------------------- | ------------------------------------------------ |
| ![Overview work queue](assets/overview-desktop.png) | ![Orders mobile cards](assets/orders-mobile.png) |

| Inventory · desktop                                 | Receive stock · mobile drawer                       |
| --------------------------------------------------- | --------------------------------------------------- |
| ![Inventory balances](assets/inventory-desktop.png) | ![Receipt drawer](assets/receipt-drawer-mobile.png) |

## 0:00–0:20 — orient the reviewer

Open the landing page and say: “StockPilot gives a small wholesale team one
calm work queue for stock, inbound receipts, and B2B orders.” Choose the
Manager demo. The overview immediately shows pending approvals, low stock,
integration failures, order value, and recent activity.

## 0:20–0:55 — receive stock

Open **Receipts**, create a receipt for an active product, and apply it. Show
that the balance and movement ledger update together. Open **Inventory** and
point out `on hand`, `reserved`, and `available`; the last value is always
`on hand - reserved`.

## 0:55–1:25 — approve and fulfill an order

Create a Draft order from **Orders**, select a customer and product, and show
the price/SKU snapshot. Confirm it as Manager. Switch to the Staff demo and
fulfill the confirmed order. The timeline records each transition, while the
inventory movement changes from reservation to sale atomically.

## 1:25–1:45 — show operational exceptions

Return to Manager and open **Integrations** or **Imports**. Retry a failed
delivery or preview a CSV containing one invalid row. Valid rows can be
committed without silently accepting the invalid row; the error CSV is
downloadable for correction.

## 1:45–2:00 — close with trust

Open **Audit** to show actor/action/entity history. Switch to Owner and open
**Settings** for the canonical team view and demo reset. Close with: “The
portfolio differentiator is the boring-but-important reliability: tenant
isolation, append-only stock history, no overselling under concurrency, and
idempotent integrations.”

For the mobile recording, use the 375px viewport and repeat the receipt-to-
fulfillment path with the bottom navigation: **Overview**, **Orders**,
**Inventory**, **More**. The checked-in assets are:

- `docs/assets/overview-desktop.png` — Overview work queue
- `docs/assets/orders-mobile.png` — responsive order cards and actions
- `docs/assets/inventory-desktop.png` — balances and low-stock exceptions
- `docs/assets/receipt-drawer-mobile.png` — receipt form and action drawer

Do not capture credentials, cookies, provider dashboards, or a preview-domain
URL. The final recording should link to the canonical origin configured in
`SITE_URL` and mention that the free demo keeps the core workflows online;
automatic background retry and reconciliation are an optional queue-enabled
acceptance profile.
