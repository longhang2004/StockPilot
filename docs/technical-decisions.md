# StockPilot technical decisions

This note records current implementation choices and their limits. It is a
code-backed walkthrough aid, not evidence that every provider or user workflow
has been accepted.

## Tenant boundary

Application requests derive organization identity from the verified session.
Tenant work sets a transaction-local `app.current_org_id` through
[`TenantDatabase`](../apps/api/src/database/tenant-database.ts); PostgreSQL
forced RLS policies provide a second boundary for the restricted runtime role.
RLS does not replace authorization checks, and privileged database roles remain
trusted. See the tenant policies in the
[catalog migration](../apps/api/prisma/migrations/20260804110000_add_catalog_inventory/migration.sql).

## Inventory state and history

`inventory_balances` is the current projection; `available` is derived from
`on_hand - reserved`. Stock-changing services lock balance rows and append
movement records in the same database transaction. The runtime app role has
SELECT/INSERT on the movement ledger without UPDATE/DELETE grants. These grants
do not constrain database owners or migration credentials. For the domain
flow, see [`docs/architecture.md`](architecture.md) and the API's
[inventory services](../apps/api/src/inventory/).

## Idempotency and unknown outcomes

Retry safety applies to commands that use the idempotency service and carry a
stable key plus the same payload. The first-party Draft create flow does so;
legacy API callers that omit the optional key keep their compatibility
behavior. A browser timeout does not prove a database transaction rolled
back. The client should reconcile or retry the same command key rather than
submitting a new command.

## Release verification

The Render workflow applies migrations and seeds before calling the required
Deploy Hook with the CI workflow's exact commit SHA. It then polls
`/v1/health/ready` for the expected API revision and database readiness.
`queue:not_configured` is acceptable only for the selected
`QUEUE_REQUIRED=false` profile. The web deployment is separate; `GET /version`
identifies the web revision independently. This verifies what is running, not
that a managed database restore or user acceptance test has been rehearsed.
See [`docs/deployment.md`](deployment.md) and
[`docs/operations.md`](operations.md).

## Performance evidence

[`docs/performance.md`](performance.md) describes the guarded local/staging
protocol and historical laptop sample. A 100k synthetic movement fixture can
help inspect one query shape and latency under one local runtime. It cannot
establish production capacity, Neon PITR, or general tenant-scale guarantees.
Use `EXPLAIN (ANALYZE, BUFFERS)` with the runtime app role and tenant context
for the exact query being discussed.
