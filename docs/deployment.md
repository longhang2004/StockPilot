# StockPilot demo deployment runbook

This is the production-shaped portfolio topology:

```mermaid
flowchart LR
  Browser[Canonical custom web domain] -->|same-origin /api rewrite| Web[Next.js web]
  Web -->|API_INTERNAL_URL| API[Render Free NestJS API]
  API -->|pooled app URL| DB[(Neon application database)]
  API -.->|optional direct queue URL| Queue[(Neon stockpilot_queue)]
```

The public demo uses one custom production domain configured as Vercel's
primary domain. Preview deployments are not functional demos because the API
trusts one canonical `WEB_ORIGIN` for CSRF. Set the same hostname in Vercel's
`SITE_URL` environment variable so metadata, JSON-LD, robots, and sitemap all
use the production origin.

## Provider settings

### Vercel

- Import `longhang2004/StockPilot` and set **Root Directory** to `apps/web`.
- Enable Vercel's **Include source files outside of the Root Directory** option
  so the workspace lockfile and `packages/contracts` are available to the
  build.
- Keep **Framework Preset** as Next.js and use Node.js 24 in project settings.
- The checked-in [`apps/web/vercel.json`](../apps/web/vercel.json) runs the
  contracts build before the web build and installs the workspace lockfile.
- Set `API_INTERNAL_URL` to the Render public API URL and `NODE_ENV=production`.
- Set `SITE_URL` to the chosen custom production origin, without a trailing
  slash. Use the same value for Production and Preview environments so preview
  builds keep production canonical URLs.
- Do not expose `API_INTERNAL_URL` as a client-side variable. The rewrite keeps
  browser requests on the canonical web origin so session cookies and CSRF
  checks are same-origin.

### Render

- Create a Blueprint from [`render.yaml`](../render.yaml), linked to
  `longhang2004/StockPilot` on `main`, with Singapore as the region.
- The Blueprint creates one **Free Web Service** from `apps/api/Dockerfile`.
  The selected free-demo profile runs the API without a pg-boss connection; no
  separate worker service is needed. A queue-enabled profile can opt in to the
  worker for a short acceptance run, but it is not suitable as an always-on
  Neon Free deployment.
- Render auto-deploys commits on `main`. The
  [Render deploy workflow](../.github/workflows/deploy-render.yml) runs Prisma
  migrations and the idempotent seed against Neon; Render then builds the same
  commit. A Deploy Hook is optional for teams that want an explicit rollout
  trigger after the migration gate. Render Free does not provide the paid
  service pre-deploy command.
- Set the Render health check to `/v1/health/ready`, generate a public
  `onrender.com` domain, and use that URL as Vercel's `API_INTERNAL_URL`.
- Add the `sync: false` variables from the Blueprint in Render's dashboard.
  Keep generated secrets in Render's secret store; never commit or print them.
- `DATABASE_URL` must be the raw PostgreSQL connection URL only. Do not paste a
  complete `.env` snippet, comments, or a second `DATABASE_URL=` wrapper into
  the Render field.

#### Render and UptimeRobot demo policy

- Render Free spins a web service down after 15 minutes without inbound
  traffic, and a wake-up can take about one minute. Render may also restart a
  Free service at any time. This is acceptable for a portfolio demo, but it is
  not a production availability guarantee.
- Create one UptimeRobot Free HTTP monitor for `/v1/health/live` at the
  five-minute interval to keep the Render process warm during ordinary demo
  hours. The live endpoint does not query Neon, so the database can still wake
  on the first real request after a quiet period.
- A `/v1/health/ready` monitor is optional and should be enabled only when its
  database-query cost is acceptable. Neon Free scales compute to zero after
  five minutes; repeated readiness probes can keep compute awake and consume
  the monthly CU allowance. Do not describe this setup as zero-latency or
  production-grade.
- The selected profile sets `QUEUE_REQUIRED=false` and omits
  `QUEUE_DATABASE_URL`. This is deliberate: pg-boss polls its database while
  idle, so an always-on worker can exhaust Neon Free's 100 CU-hour allowance
  (about 400 hours, or 16.7 days, at the default 0.25 CU size). Configure the
  queue URL and set `QUEUE_REQUIRED=true` only for a short acceptance run; the
  manual integration retry endpoint remains available without the worker.
- Render Free includes 750 instance-hours per workspace per month. A single
  service kept warm by a five-minute monitor fits within that budget in a
  normal month, but Render can suspend Free services if the workspace limits
  are exhausted.

### Neon

- Create the project in the region closest to Render (Singapore/Asia when
  available).
- Run [`infra/postgres/provision-production.sql`](../infra/postgres/provision-production.sql)
  with a direct migration connection and psql variables for both generated
  passwords. The script provisions the isolated queue database, but the normal
  free profile leaves its URL unused.
- Apply Prisma migrations through the direct migration URL. The runtime API
  uses a pooled `stockpilot_app` URL. A queue-enabled acceptance profile uses a
  direct URL to the separate `stockpilot_queue` database.
- Confirm `stockpilot_app` has `rolbypassrls=false`, is not a member of
  `neon_superuser`, and that tenant tables have both RLS and forced RLS.

## Environment matrix

| Variable                 | Vercel               | Render                       | Notes                                                                                                                    |
| ------------------------ | -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `API_INTERNAL_URL`       | Render public URL    | —                            | Production-only rewrite target.                                                                                          |
| `DATABASE_URL`           | —                    | pooled `stockpilot_app` URL  | Runtime queries only.                                                                                                    |
| `MIGRATION_DATABASE_URL` | —                    | —                            | GitHub Actions only; direct migration URL.                                                                               |
| `QUEUE_DATABASE_URL`     | —                    | —                            | Unset on the free profile; opt-in short acceptance only.                                                                 |
| `QUEUE_REQUIRED`         | —                    | `false`                      | Readiness allows `queue:not_configured` on the free profile.                                                             |
| `SITE_URL`               | chosen custom origin | —                            | Canonical metadata/sitemap origin; no trailing slash.                                                                    |
| `WEB_ORIGIN`             | —                    | exact custom origin          | No trailing slash; one canonical origin for CSRF.                                                                        |
| `NODE_ENV`               | `production`         | `production`                 | Enables secure cookies and production behavior.                                                                          |
| `DEMO_MODE`              | —                    | `true`                       | Enables one-click demo accounts.                                                                                         |
| `DEMO_ORGANIZATION_SLUG` | —                    | `stockpilot-demo`            | Canonical demo tenant.                                                                                                   |
| `CSRF_SECRET`            | —                    | generated secret (32+ chars) | Generated once by the Render Blueprint.                                                                                  |
| `WEBHOOK_SIGNING_SECRET` | —                    | generated secret (16+ chars) | Generated once by the Render Blueprint.                                                                                  |
| `SESSION_COOKIE_NAME`    | —                    | `stockpilot_session`         | Change to expire all existing cookies.                                                                                   |
| `MAX_ACTIVE_SESSIONS_PER_USER` | —              | `10`                         | Active sessions kept per user; the oldest beyond the cap are revoked on new logins.                                      |
| `RATE_LIMIT_PUBLIC_WRITES_PER_MIN` | —        | `60`                         | Public non-auth writes (webhooks) per client per route per minute.                                                       |
| `RATE_LIMIT_AUTH_WRITES_PER_MIN`    | —        | `10`                         | Credential endpoints (login/signup/demo-login) per client per minute.                                                     |
| `RATE_LIMIT_USER_WRITES_PER_MIN`    | —        | `240`                        | Authenticated writes per user per minute.                                                                                |
| `AUTH_FAILURE_LIMIT`     | —                    | `5`                          | Failed sign-ins per (email, client) before temporary block.                                                              |
| `AUTH_FAILURE_WINDOW_MINUTES` | —                | `15`                         | Failure counting window for the sign-in throttle.                                                                        |
| `AUTH_FAILURE_BLOCK_MINUTES`  | —                | `15`                         | How long blocked (email, client) pairs stay blocked.                                                                     |
| `TRUSTED_PROXY_CIDRS`    | —                    | unset (safe default)         | Comma-separated reverse-proxy CIDRs allowed to set `X-Forwarded-For` for rate limiting; see [operations](operations.md). |
| `SENTRY_DSN`             | —                    | optional                     | Leave empty when Sentry is not configured.                                                                               |

### GitHub Actions secrets

These values are used only by `.github/workflows/deploy-render.yml` and are
never copied into the Render runtime:

| Secret                   | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `MIGRATION_DATABASE_URL` | Direct Neon owner/migration URL for Prisma migrations and seed.         |
| `RENDER_DEPLOY_HOOK_URL` | Optional Deploy Hook URL for an explicit rollout; omit for auto-deploy. |

## First deployment order

1. Choose the custom domain, attach it to Vercel, and make it the primary
   production domain. Record the exact origin without a trailing slash.
2. Create the Neon project and provision the app and isolated queue roles with
   [`infra/postgres/provision-production.sql`](../infra/postgres/provision-production.sql).
   Leave the queue URL unset for the normal free profile; it is used only for a
   short queue-enabled acceptance run. The deploy workflow owns the first
   migration and seed, so do not run them twice.
3. Create the Render Blueprint from `main`, fill the `sync: false` variables,
   and add `MIGRATION_DATABASE_URL` as a GitHub repository secret. If an
   explicit rollout gate is desired, also create a Deploy Hook and add its URL
   as the optional `RENDER_DEPLOY_HOOK_URL` secret.
4. Merge or push a commit to `main` after CI is green. The
   [`deploy-render.yml`](../.github/workflows/deploy-render.yml) workflow then
   applies migrations and seeds the canonical fixture. Render's `main` branch
   auto-deploy builds the API; if the optional hook secret is set, the workflow
   can trigger the matching commit explicitly.
5. Set Render's public URL as Vercel `API_INTERNAL_URL`, set Vercel `SITE_URL`
   to the custom origin, and redeploy Vercel.
6. Set Render `WEB_ORIGIN` to that same custom origin, redeploy the API, then
   verify demo login, session cookies, and CSRF from the custom domain.
7. Configure the live UptimeRobot monitor (and the optional readiness monitor
   only if its Neon CU cost is acceptable), then run the smoke checklist below
   from the demo origin.
8. Keep CI required on `main`, block force-pushes and branch deletion, and keep
   the default branch as `main`. Leave Render auto-deploy enabled for the normal
   free-demo path.

The selected Render Free, Neon Free, Vercel Hobby, and UptimeRobot Free path
does not require a billing upgrade. Do not paste the migration URL or deploy
hook into source code or chat.

## Routine release

1. Merge a reviewed change to protected `main` after CI is green.
2. GitHub Actions runs `prisma migrate deploy` followed by the idempotent seed
   against Neon. Render auto-deploys the same `main` commit; when
   `RENDER_DEPLOY_HOOK_URL` is configured, the workflow may trigger that hook
   after the migration gate as an explicit rollout.
3. Confirm readiness (`queue:not_configured` is expected on the free profile)
   and the Render release log. If the opt-in queue profile is enabled, also
   confirm pg-boss scheduling. Vercel then builds the web project from the same
   commit.
4. Run the smoke paths that touch the changed area and record the release URL
   in the test report.

## Migration failure, rollback, and restore

- Read a failed GitHub migration/seed log and fix it in a reviewed migration;
  never mark `_prisma_migrations` manually. If Render auto-deployed the commit
  before the CI gate failed, cancel or roll back that deployment before
  retrying. An optional Deploy Hook is only called after the migration/seed
  commands succeed.
- For an application regression, redeploy the previous known-good commit via
  Render and Vercel. Do not roll back a schema migration unless the migration
  explicitly includes a safe backwards-compatible down path.
- For database corruption or accidental data loss, create a Neon point-in-time
  restore/branch, apply migrations using the direct migration URL, run the role
  and ledger verification queries, then update Render's pooled app URL.
- Restore queue data separately when needed. pg-boss jobs are retryable; a
  duplicate integration delivery must remain deduplicated by its external ID.

## Demo smoke checklist

```bash
curl -fsS "$API_URL/v1/health/live"
curl -fsS "$API_URL/v1/health/ready"
curl -fsS "$API_URL/docs" >/dev/null
curl -fsS "$API_URL/openapi.json" >/dev/null
```

Then verify through the canonical production origin configured in `SITE_URL`:

- one-click Owner, Manager, and Staff login;
- Manager receipt and order confirmation;
- Staff fulfillment and the resulting sale movement;
- duplicate webhook creates one Draft order;
- Owner reset recreates the canonical fixture;
- Secure/HttpOnly/SameSite cookies and CSRF through `/api`;
- failed integration retry succeeds through the manual API action. pg-boss
  retry delivery and scheduled reconciliation are checked only in the opt-in
  queue-enabled acceptance profile;
- runtime role cannot bypass RLS or update/delete ledger rows;
- desktop/mobile screenshots and axe smoke remain green.

## Cost and safety guardrails

The selected path is intentionally free and demo-oriented. Review Render's
750-hour allowance, UptimeRobot monitor status, and Neon CU-hour usage monthly;
disable the optional readiness monitor and pause the public service if the
demo is no longer needed. The custom domain remains a launch gate; a paid
Render instance, Sentry DSN, and narrated video are optional follow-up work.

Official provider references: [Render Blueprint spec](https://render.com/docs/blueprint-spec),
[Render free services](https://render.com/docs/free),
[Render deploys](https://render.com/docs/deploys),
[UptimeRobot Free plan](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan),
[Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero),
[Neon pooling](https://neon.com/docs/connect/connection-pooling), and
[Neon role behavior](https://neon.com/docs/reference/compatibility).
