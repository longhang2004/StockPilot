# StockPilot architecture

StockPilot is a modular monolith. The web app talks to the API through a
same-origin `/api` rewrite, while the API owns transactions, authorization,
RLS context, and the PostgreSQL ledger.

```mermaid
flowchart LR
  Browser[Next.js web] -->|same-origin /api| API[NestJS API]
  Storefront[Signed storefront webhook] --> API
  API -->|tenant transaction + RLS| DB[(PostgreSQL)]
  API -->|pg-boss retries| Jobs[Queue worker]
  API --> Docs[OpenAPI /docs]
```

Every tenant mutation follows the same shape:

1. Resolve organization and actor from the session (or signed integration
   destination), never from a client-supplied organization id.
2. Set `app.current_org_id` and `app.current_actor_id` in a transaction.
3. Lock balance rows in sorted product-id order when stock can change.
4. Write the projection and append-only movement/audit records atomically.
5. Store the idempotent response under a stable payload fingerprint.

Stock-changing mutations call the low-stock reconciliation service in the same
transaction. A scheduled pg-boss job periodically locks and reconciles every
balance so an alert cannot remain stale after an out-of-band repair. The
dashboard and Owner settings/team screens are read models over the same
tenant-scoped transaction boundary; they never accept organization identity
from the browser.

The observability boundary is deliberately small: a request interceptor emits
structured JSON with trace, actor, organization, method, route, status, and
duration metadata; the redaction utility masks cookies, authorization values,
CSRF tokens, webhook signatures, and credential-bearing URLs before logging.
Sentry is optional and receives only the redacted exception context.

The database is authoritative for `on_hand`, `reserved`, and the movement
ledger. `available` is always computed as `on_hand - reserved`; no UI value is
allowed to become a second source of truth.
