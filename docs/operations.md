# StockPilot operations guide

This guide covers the small production demo running as one Railway API/worker
service, one Vercel web project, and Neon application plus queue databases.

## Health and readiness

`GET /v1/health/live` is a process liveness check and does not touch a
database. `GET /v1/health/ready` performs a database probe and reports the
pg-boss state in the same payload:

| HTTP | `status`   | Meaning                                                                        |
| ---- | ---------- | ------------------------------------------------------------------------------ |
| 200  | `ready`    | Database is available and either the queue is ready or `QUEUE_REQUIRED=false`. |
| 503  | `degraded` | Database is unavailable, or `QUEUE_REQUIRED=true` and the queue is not ready.  |

The `checks.database` and `checks.queue` fields are intentionally returned for
both statuses. Railway should use `QUEUE_REQUIRED=true`; local development may
leave the queue URL unset and use the default `false` policy.

## Logs and jobs

Railway logs are structured JSON. Search by `traceId`, `organizationId`,
`actorUserId`, route, or status. Cookies, authorization values, CSRF tokens,
webhook signatures, credential-bearing URLs, and database connection strings
must be redacted before they reach logs.

The worker creates these pg-boss queues:

- `stockpilot.integration.retry` — failed storefront deliveries, with retry
  backoff and a five-attempt limit.
- `stockpilot.inventory.reconcile` — every 15 minutes, repairing stale
  low-stock alert projections.
- `stockpilot.integration.dead-letter` — exhausted jobs retained for 30 days.

After a delivery fails, open **Integrations**, inspect the error, and use the
manual retry action. If the retry queue is unavailable, the API still records
the delivery failure; restore the worker and retry from the UI. Never edit a
stock movement or audit row to repair a job.

## Demo reset and canonical data

The Owner reset endpoint performs delete → reseed → audit → schedule-next-reset
inside one tenant transaction. Automatic reset runs on the next demo login when
the six-hour deadline is due. The canonical fixture contains 8 active products,
1 inactive product, 5 customers, 3 suppliers, 8 balances, two open low-stock
alerts, six orders, one failed delivery, and one partial CSV preview.

The seed is idempotent: a pre-deploy seed only populates a demo organization
when it has no operational rows. It never overwrites an active demo session.

## Database recovery

1. Stop traffic by pausing the Railway deployment or removing the Vercel
   `API_INTERNAL_URL` target.
2. Capture Railway logs, the readiness payload, the migration name, and the
   latest Neon restore point before changing data.
3. Restore Neon to a point-in-time clone or branch. Keep the original database
   read-only until invariants are checked.
4. Run `prisma migrate deploy` with the direct migration URL only. Do not run
   migrations through a pooled URL.
5. Verify the runtime role has `rolbypassrls=false`, is not a member of
   `neon_superuser`, and cannot update/delete append-only tables.
6. Point Railway at the restored pooled app URL, restart, and run the smoke
   checklist in [`docs/deployment.md`](deployment.md).

For a migration failure, do not manually mark `_prisma_migrations` complete.
Read the failed migration log, fix the migration or database state in a
reviewed change, then rerun the pre-deploy command. Railway will not promote a
release whose pre-deploy command exits non-zero.

## Secret rotation

Generate a new `CSRF_SECRET` or `WEBHOOK_SIGNING_SECRET`, update Railway first,
redeploy, then invalidate old sessions or rotate the upstream webhook sender.
Changing `SESSION_COOKIE_NAME` is the quickest way to expire every browser
session. Never place production values in `.env.production`, Vercel linking
state, the repository, or a screenshot.

## Incident checklist

- [ ] Confirm `/v1/health/live` and `/v1/health/ready` status and checks.
- [ ] Capture trace IDs and redact logs before sharing them.
- [ ] Check Neon connection saturation and the direct queue database.
- [ ] Check pg-boss retry/dead-letter counts and pause manual retries if the
      root cause is not understood.
- [ ] Confirm no tenant, ledger, or audit rows were edited outside a reviewed
      migration.
- [ ] Use the Owner demo reset only for the public demo, never as a production
      data recovery mechanism.
- [ ] Record the timeline, customer impact, mitigation, and follow-up issue.
