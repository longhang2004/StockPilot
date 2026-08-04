# StockPilot architecture

StockPilot is a modular monolith. The web app talks to the API through a
same-origin `/api` rewrite, while the API owns transactions, authorization,
RLS context, and the PostgreSQL ledger.

```mermaid
flowchart LR
  Browser[Canonical Vercel origin] -->|same-origin /api| Web[Next.js web]
  Web -->|API_INTERNAL_URL| API[NestJS API on Railway]
  Storefront[Signed storefront webhook] --> API
  API -->|tenant transaction + RLS| DB[(PostgreSQL)]
  API -->|direct connection| Queue[(Neon stockpilot_queue)]
  Queue --> Jobs[pg-boss worker]
  API --> Docs[OpenAPI /docs]
```

Production uses a pooled Neon URL for application traffic, a direct migration
URL for Prisma release commands, and a separate direct queue URL for pg-boss.
The Railway service runs the API and worker together so readiness can require
the queue without moving business code into serverless functions.

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

The public demo is seeded with deterministic, organization-scoped fixture IDs.
The first deploy only seeds an empty demo organization; Owner and automatic
six-hour reset use the same fixture after deleting operational rows, then write
the reset audit event and next-reset schedule in the same transaction.
