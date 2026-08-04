# StockPilot operations guide

This guide covers the small portfolio demo running as one Render Free API
service, one Vercel web project, an UptimeRobot live monitor, and a Neon
application database. The normal free profile does not connect pg-boss to a
queue database; a queue database and worker are opt-in for short acceptance
runs only.

## Health and readiness

`GET /v1/health/live` is a process liveness check and does not touch a
database. `GET /v1/health/ready` performs a database probe and reports the
pg-boss state in the same payload:

| HTTP | `status`   | Meaning                                                                        |
| ---- | ---------- | ------------------------------------------------------------------------------ |
| 200  | `ready`    | Database is available and either the queue is ready or `QUEUE_REQUIRED=false`. |
| 503  | `degraded` | Database is unavailable, or `QUEUE_REQUIRED=true` and the queue is not ready.  |

The `checks.database` and `checks.queue` fields are intentionally returned for
both statuses. The selected Render profile uses `QUEUE_REQUIRED=false` and
leaves `QUEUE_DATABASE_URL` unset, so `queue:not_configured` with HTTP 200 is
expected. Set both values only for a short queue-enabled acceptance run.

Render Free services can sleep after 15 minutes without inbound traffic. The
UptimeRobot `/v1/health/live` monitor runs every five minutes to keep normal
demo usage warm. It does not query Neon, so the first real database request
after a quiet period can still add startup latency. A readiness monitor is
optional: repeated database probes can consume Neon Free compute hours.

## Logs and jobs

Render logs are structured JSON. Search by `traceId`, `organizationId`,
`actorUserId`, route, or status. Cookies, authorization values, CSRF tokens,
webhook signatures, credential-bearing URLs, and database connection strings
must be redacted before they reach logs.

When the opt-in queue profile is enabled, the worker creates these pg-boss
queues:

- `stockpilot.integration.retry` — failed storefront deliveries, with retry
  backoff and a five-attempt limit.
- `stockpilot.inventory.reconcile` — every 15 minutes, repairing stale
  low-stock alert projections.
- `stockpilot.integration.dead-letter` — exhausted jobs retained for 30 days.

After a delivery fails, open **Integrations**, inspect the error, and use the
manual retry action. In the normal free profile, the API performs that retry
synchronously and records the result; automatic pg-boss retry and scheduled
reconciliation are disabled. If an opt-in retry queue is unavailable, restore
the worker and retry from the UI. Never edit a stock movement or audit row to
repair a job.

## Demo reset and canonical data

The Owner reset endpoint performs delete → reseed → audit → schedule-next-reset
inside one tenant transaction. Automatic reset runs on the next demo login when
the six-hour deadline is due. The canonical fixture contains 8 active products,
1 inactive product, 5 customers, 3 suppliers, 8 balances, two open low-stock
alerts, six orders, one failed delivery, and one partial CSV preview.

The seed is idempotent: the CI deployment seed only populates a demo
organization when it has no operational rows. It never overwrites an active
demo session.

## Database recovery

1. Stop traffic by pausing the Render deployment or removing the Vercel
   `API_INTERNAL_URL` target.
2. Capture Render logs, the readiness payload, the migration name, and the
   latest Neon restore point before changing data.
3. Restore Neon to a point-in-time clone or branch. Keep the original database
   read-only until invariants are checked.
4. Run `prisma migrate deploy` with the direct migration URL only. Do not run
   migrations through a pooled URL.
5. Verify the runtime role has `rolbypassrls=false`, is not a member of
   `neon_superuser`, and cannot update/delete append-only tables.
6. Point Render at the restored pooled app URL, restart, and run the demo smoke
   checklist in [`docs/deployment.md`](deployment.md).

For a migration failure, do not manually mark `_prisma_migrations` complete.
Read the failed migration log, fix the migration or database state in a
reviewed change, then rerun the migration/seed workflow. The Render deploy hook
is only called after those commands succeed.

## Secret rotation

Generate a new `CSRF_SECRET` or `WEBHOOK_SIGNING_SECRET`, update Render first,
redeploy, then invalidate old sessions or rotate the upstream webhook sender.
Changing `SESSION_COOKIE_NAME` is the quickest way to expire every browser
session. Never place production values in `.env.production`, Vercel linking
state, the repository, or a screenshot.

## Incident checklist

- [ ] Confirm `/v1/health/live` and `/v1/health/ready` status and checks.
- [ ] Capture trace IDs and redact logs before sharing them.
- [ ] Check Neon connection saturation; inspect the direct queue database only
      when the opt-in queue profile is enabled.
- [ ] Check pg-boss retry/dead-letter counts only for a queue-enabled run, and
      pause manual retries if the root cause is not understood.
- [ ] Confirm no tenant, ledger, or audit rows were edited outside a reviewed
      migration.
- [ ] Use the Owner demo reset only for the public demo, never as a production
      data recovery mechanism.
- [ ] Record the timeline, customer impact, mitigation, and follow-up issue.
