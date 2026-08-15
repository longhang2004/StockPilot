#!/usr/bin/env node
/**
 * E2E dev-server supervisor.
 *
 * `pnpm dev` starts the API and web app in parallel, so Playwright's
 * webServer readiness poll on :3000 can pass while the NestJS API is still
 * compiling and booting. Tests that hit /api in that window see 500s and
 * fail with "We could not start the demo" — a startup race, not an
 * application regression.
 *
 * This supervisor starts the API first, waits for its READINESS endpoint
 * (DB-backed, so the suite never races database connectivity either), then
 * starts the web app. Playwright's webServer.url poll (:3000) then implies
 * both processes are ready. Child output is inherited so CI retains the
 * full server log next to the Playwright report.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import process from 'node:process';

try {
  process.loadEnvFile('.env');
} catch {
  // Ignored if .env already exported
}

// Readiness, not liveness: E2E exercises DB-backed endpoints, so the gate
// must prove the API can serve them (QUEUE_REQUIRED=false is compatible —
// readiness returns 200 with queue:not_configured). The API port follows
// the API's own PORT convention so a host already using :4000 can run the
// suite elsewhere (set PORT and API_INTERNAL_URL together).
const API_PORT = process.env.PORT ?? '4000';
const API_READY_URL = `http://localhost:${API_PORT}/v1/health/ready`;
const WEB_URL = 'http://localhost:3000';
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 500;

// Tee child output to a log file next to the Playwright artifacts so CI
// failures retain the API/web server logs for diagnosis.
const SERVER_LOG_PATH = 'test-results/e2e-server.log';
mkdirSync('test-results', { recursive: true });

function tee(stream, label) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    try {
      appendFileSync(SERVER_LOG_PATH, `[${label}] ${text}`);
    } catch {
      // Logging must never take the server down.
    }
  });
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${url}: ${lastError}`,
  );
}

/**
 * Fails fast when a foreign process already occupies the API port. A stale
 * server on :4000 (orphaned dev process or leftover container) would
 * otherwise answer the health probe and run the whole suite against the
 * wrong process — the exact failure mode this script exists to prevent.
 */
async function assertPortFree(port, label) {
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(1_000),
    });
    fail(
      `${label} port ${port} is already in use (HTTP ${response.status}). ` +
        'Stop the other process (check for orphaned dev servers or Docker ' +
        'containers) and re-run.',
    );
  } catch (error) {
    const causeCode = error?.cause?.code;
    if (causeCode === 'ECONNREFUSED') return;
    fail(`${label} port ${port} appears to be in use (${error}).`);
  }
}

function fail(message) {
  console.error(`[e2e-server] ${message}`);
  process.exit(1);
}

await assertPortFree(Number(API_PORT), 'API');
await assertPortFree(3000, 'Web');

const api = spawn('pnpm', ['--filter', '@stockpilot/api', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
});
tee(api.stdout, 'api');
tee(api.stderr, 'api');
api.on('exit', (code) => {
  if (code !== null && code !== 0) {
    fail(`API dev server exited unexpectedly (code ${code}).`);
  }
});

try {
  await waitFor(API_READY_URL, READY_TIMEOUT_MS);
  console.error('[e2e-server] API is ready; starting web app.');
} catch (error) {
  api.kill('SIGTERM');
  fail(error.message);
}

const web = spawn(
  'pnpm',
  ['--filter', '@stockpilot/web', 'dev', '--port', '3000'],
  {
    stdio: ['inherit', 'pipe', 'pipe'],
    // The web app must serve Playwright's webServer.url (:3000). It inherits
    // everything else — including API_INTERNAL_URL, which points at the API
    // port (PORT may differ from 3000 when a host already uses it).
    env: { ...process.env, PORT: '3000' },
  },
);
tee(web.stdout, 'web');
tee(web.stderr, 'web');
web.on('exit', (code) => {
  if (code !== null && code !== 0) {
    fail(`Web dev server exited unexpectedly (code ${code}).`);
  }
});

try {
  await waitFor(WEB_URL, READY_TIMEOUT_MS);
  console.error('[e2e-server] web app is ready.');
} catch (error) {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  fail(error.message);
}

// next/og metadata routes (/icon, /apple-icon, og images) compile lazily in
// dev; the first request can reset the connection while satori/WASM
// initializes (reproduced in CI as `socket hang up` on GET /icon, failing
// the seo suite on a cold runner). Pre-warm them so tests never race the
// one-time compile. Production builds prerender these routes, so this only
// affects the dev-mode test server.
const METADATA_ROUTES = [
  '/icon',
  '/apple-icon',
  '/opengraph-image',
  '/twitter-image',
];
for (const route of METADATA_ROUTES) {
  let warmed = false;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${WEB_URL}${route}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok || response.status === 404) {
        warmed = true;
        break;
      }
      console.error(
        `[e2e-server] metadata route ${route} returned HTTP ${response.status}; retrying (${attempt}/5)`,
      );
    } catch (error) {
      console.error(
        `[e2e-server] metadata route ${route} warm-up failed (${error?.cause?.code ?? error}); retrying (${attempt}/5)`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  if (!warmed) {
    api.kill('SIGTERM');
    web.kill('SIGTERM');
    fail(`metadata route ${route} did not become ready after 5 attempts.`);
  }
}
console.error('[e2e-server] metadata image routes warmed.');

// Keep both children alive; forward termination so Playwright teardown (or
// Ctrl-C locally) shuts the whole tree down cleanly.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    api.kill(signal);
    web.kill(signal);
  });
}
