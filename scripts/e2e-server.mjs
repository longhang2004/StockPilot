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

// Readiness, not liveness: E2E exercises DB-backed endpoints, so the gate
// must prove the API can serve them (QUEUE_REQUIRED=false is compatible —
// readiness returns 200 with queue:not_configured). E2E-specific ports avoid
// colliding with other local dev servers; PORT remains a fallback for the API.
const API_PORT = process.env.E2E_API_PORT ?? process.env.PORT ?? '4000';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '3000';
const API_READY_URL = `http://localhost:${API_PORT}/v1/health/ready`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 500;

// Tee child output to a log file next to the Playwright artifacts so CI
// failures retain the API/web server logs for diagnosis.
const SERVER_LOG_PATH = 'test-results/e2e-server.log';
mkdirSync('test-results', { recursive: true });
const children = [];
let stopping = false;

function stop(signal = 'SIGTERM', exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid === undefined) continue;
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        console.error(
          `[e2e-server] Could not stop child process group: ${error}`,
        );
      }
    }
  }
  // Each child is a process-group leader on POSIX, so its descendants receive
  // the signal before this supervisor exits.
  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => stop(signal));
}

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
  stop('SIGTERM', 1);
}

await assertPortFree(Number(API_PORT), 'API');
await assertPortFree(Number(WEB_PORT), 'Web');

const api = spawn('pnpm', ['--filter', '@stockpilot/api', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
  env: { ...process.env, PORT: API_PORT, WEB_ORIGIN: WEB_URL },
});
children.push(api);
tee(api.stdout, 'api');
tee(api.stderr, 'api');
api.on('error', (error) => fail(`Could not start API dev server: ${error}`));
api.on('exit', (code, signal) => {
  if (!stopping) {
    fail(
      `API dev server exited unexpectedly (code ${code}, signal ${signal}).`,
    );
  }
});

try {
  await waitFor(API_READY_URL, READY_TIMEOUT_MS);
  console.error('[e2e-server] API is ready; starting web app.');
} catch (error) {
  fail(error.message);
}

const web = spawn('pnpm', ['--filter', '@stockpilot/web', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
  // Keep web rewrites and browser origin aligned with the selected E2E ports.
  env: {
    ...process.env,
    API_INTERNAL_URL: `http://localhost:${API_PORT}`,
    NODE_ENV: 'development',
    PORT: WEB_PORT,
    SITE_URL: WEB_URL,
  },
});
children.push(web);
tee(web.stdout, 'web');
tee(web.stderr, 'web');
web.on('error', (error) => fail(`Could not start web dev server: ${error}`));
web.on('exit', (code, signal) => {
  if (!stopping) {
    fail(
      `Web dev server exited unexpectedly (code ${code}, signal ${signal}).`,
    );
  }
});

try {
  await waitFor(WEB_URL, READY_TIMEOUT_MS);
  console.error('[e2e-server] web app is ready.');
} catch (error) {
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
      if (response.ok) {
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
    fail(`metadata route ${route} did not become ready after 5 attempts.`);
  }
}
console.error('[e2e-server] metadata image routes warmed.');

// Keep both process groups alive until Playwright teardown or Ctrl-C.
