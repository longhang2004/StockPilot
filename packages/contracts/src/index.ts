/**
 * @stockpilot/contracts — the shared Zod contract boundary between the API
 * and the web client.
 *
 * Domain modules (auth, catalog, inventory, orders, billing, integrations,
 * audit, analytics) each own the contracts for their slice of the API.
 * This barrel re-exports everything so `@stockpilot/contracts` root imports
 * keep working without forcing callers onto deep imports.
 *
 * Shared wire contracts are centralized here. Most response contracts are
 * Zod schemas whose inferred types describe the JSON wire shape (dates and
 * money serialized as strings) — those are used where runtime/OpenAPI
 * projection provides value. A few (e.g. OverviewResponse) are type-only
 * contracts consumed read-only by the web client, which does not parse
 * responses at runtime.
 */
export * from './common.js';
export * from './problem-details.js';
export * from './auth.js';
export * from './catalog.js';
export * from './inventory.js';
export * from './orders.js';
export * from './billing.js';
export * from './integrations.js';
export * from './imports.js';
export * from './audit.js';
export * from './analytics.js';
