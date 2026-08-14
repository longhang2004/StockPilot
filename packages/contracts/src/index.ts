/**
 * @stockpilot/contracts — the shared Zod contract boundary between the API
 * and the web client.
 *
 * Domain modules (auth, catalog, inventory, orders, billing, integrations,
 * audit, analytics) each own the schemas for their slice of the API. This
 * barrel re-exports everything so `@stockpilot/contracts` root imports keep
 * working without forcing callers onto deep imports.
 *
 * Response contracts are Zod schemas whose inferred types describe the
 * JSON wire shape (dates and money serialized as strings). The web client
 * consumes the inferred types read-only and does not parse responses at
 * runtime; OpenAPI projects the same schemas for documentation.
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
