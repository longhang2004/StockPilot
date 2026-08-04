# StockPilot threat model

## Assets

- Organization data, customer contact details, prices, and stock levels.
- The append-only movement and audit history.
- Session cookies, CSRF secrets, and storefront signing secrets.

## Trust boundaries

| Boundary         | Control                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| Browser → API    | Same-origin proxy, HttpOnly cookie, Origin check, CSRF token             |
| API → database   | Runtime role has `NOBYPASSRLS`; every tenant table uses forced RLS       |
| Storefront → API | HMAC signature, delivery idempotency, explicit organization slug         |
| Role → mutation  | Permission guard separates Staff, Manager, and Owner actions             |
| Ledger → UI      | Database checks plus compensating movements; no update/delete grants     |
| Logs → operators | Structured request logs with recursive secret redaction; optional Sentry |
| Browser → assets | CSP, `X-Content-Type-Options`, frame denial, and referrer policy         |

## Important abuse cases

- **Cross-tenant identifier guessing:** identifiers are always queried inside a
  tenant transaction and RLS rejects mismatched organization columns.
- **Overselling under concurrency:** confirmation locks balances in a stable
  order, checks availability, and reserves in the same transaction.
- **Replay or duplicate webhook:** HMAC is verified before processing and the
  organization + delivery idempotency key can create only one Draft order.
- **CSRF on public login:** public browser writes still require a trusted
  Origin; only the HMAC webhook has an explicit CSRF exemption.
- **Ledger tampering:** runtime privileges revoke update/delete and the demo
  reset is a narrowly scoped security-definer function that accepts demo
  organizations only.

Secrets are read from environment variables, never returned in problem details
or audit payloads. The Next.js response also sets a restrictive CSP and
security headers. Production deployments should add a managed secret store,
centralized log retention controls, rate-limit monitoring, and Sentry DSN
configuration. Mobile and desktop clients use the same tenant-aware API, so
responsive presentation does not create a second authorization surface.
