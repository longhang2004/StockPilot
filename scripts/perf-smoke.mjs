#!/usr/bin/env node
/**
 * StockPilot performance smoke harness.
 *
 * A deliberately small, dependency-free load probe for representative API
 * workloads. It measures latency/throughput/errors and prints a table; it
 * is NOT a benchmarking platform and makes no internet-scale claims.
 *
 * Usage:
 *   API_URL=http://localhost:4000 pnpm perf:smoke            # read-only defaults
 *   pnpm perf:smoke -- --concurrency 20 --requests 500 --json
 *   pnpm perf:smoke -- --include-writes    # opt-in demo-login workload
 *   pnpm perf:smoke -- --rate-limit-check  # assert 429 enforcement
 *
 * Default workloads (authenticated reads only):
 *   orders-list        GET /v1/orders
 *   balances-list      GET /v1/inventory/balances
 *
 * Opt-in workload (--include-writes):
 *   demo-login         POST /v1/auth/demo-login (public write; creates one
 *                       session row per request — cleaned by the six-hour
 *                       demo reset). The public-write rate limiter caps this
 *                       route at 60/min per client, so the write workload is
 *                       capped at 40 requests per run to stay clear of it.
 *
 * Rate-limit check (--rate-limit-check): a dedicated mode that runs ONLY
 * demo-login and asserts that the limiter returns 429 once the threshold is
 * crossed. Expected 429 responses are NOT treated as performance failures —
 * this mode exists to verify the limiter is enforced. Exits non-zero when
 * no 429 is observed or an unexpected status appears.
 *
 * Prerequisites: a running API with the seeded demo organization
 * (DEMO_MODE=true). See docs/performance.md.
 */
import process from 'node:process';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
// Public writes require a trusted Origin (CSRF defense), so the harness
// sends the same origin a browser would.
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_REQUESTS = 200;
// The rate-limit check crosses the 60/min threshold by design; a dedicated,
// smaller default keeps a single check run fast while still proving 429
// enforcement.
const RATE_LIMIT_CHECK_DEFAULT_REQUESTS = 100;
const TIMEOUT_MS = 15_000;
// Public-write limiter ceiling for /v1/auth/demo-login: 60/min per client.
// The opt-in write workload stays below it so 429s never pollute latency
// measurements.
const WRITE_WORKLOAD_REQUEST_CAP = 40;

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined
    ? args[index + 1]
    : fallback;
}
const concurrency = Number(argValue('--concurrency', DEFAULT_CONCURRENCY));
const includeWrites = args.includes('--include-writes');
const rateLimitCheck = args.includes('--rate-limit-check');
// The rate-limit check has its own smaller default (100) so normal perf
// runs keep DEFAULT_REQUESTS=200 while a check stays quick and deliberate.
const requests = Number(
  argValue(
    '--requests',
    rateLimitCheck ? RATE_LIMIT_CHECK_DEFAULT_REQUESTS : DEFAULT_REQUESTS,
  ),
);
const jsonOutput = args.includes('--json');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`StockPilot performance smoke harness

Usage:
  API_URL=http://localhost:4000 pnpm perf:smoke [--concurrency N] [--requests N] [--json]
  pnpm perf:smoke -- --include-writes     # add the demo-login write workload (capped at 40)
  pnpm perf:smoke -- --rate-limit-check   # verify the limiter returns 429 past the threshold

Default workloads: orders-list, balances-list (authenticated reads).
Reports per-workload throughput, p50/p90/p95/p99 latency, error count, and
the first error.`);
  process.exit(0);
}

function percentile(sortedLatencies, fraction) {
  if (sortedLatencies.length === 0) return 0;
  const index = Math.min(
    sortedLatencies.length - 1,
    Math.ceil(fraction * sortedLatencies.length) - 1,
  );
  return sortedLatencies[index];
}

async function runWorkload(name, requestsToRun, makeRequest) {
  const latencies = [];
  const statuses = [];
  let errors = 0;
  let firstError = null;
  const startedAt = performance.now();
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= requestsToRun) return;
      const requestStartedAt = performance.now();
      try {
        const response = await makeRequest(index);
        statuses.push(response.status);
        if (!response.ok) {
          errors += 1;
          if (!firstError) firstError = `HTTP ${response.status} on ${name}`;
        }
      } catch (error) {
        errors += 1;
        if (!firstError)
          firstError = `${error?.name ?? 'Error'}: ${error?.message ?? error}`;
      }
      latencies.push(performance.now() - requestStartedAt);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedMs = performance.now() - startedAt;
  const sorted = [...latencies].sort((a, b) => a - b);

  return {
    name,
    requests: latencies.length,
    errors,
    firstError,
    statuses,
    elapsedMs,
    rps: (latencies.length / elapsedMs) * 1000,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function formatRow(row) {
  return [
    row.name.padEnd(16),
    String(row.requests).padStart(7),
    `${row.rps.toFixed(1)}`.padStart(8),
    `${row.p50.toFixed(1)}`.padStart(8),
    `${row.p90.toFixed(1)}`.padStart(8),
    `${row.p95.toFixed(1)}`.padStart(8),
    `${row.p99.toFixed(1)}`.padStart(8),
    String(row.errors).padStart(6),
  ].join('  ');
}

function demoLoginRequest() {
  return fetch(`${API_URL}/v1/auth/demo-login`, {
    body: JSON.stringify({ role: 'MANAGER' }),
    headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function authenticate() {
  // The bootstrap login is one public write; when a previous
  // --rate-limit-check (or any burst) left the demo-login window hot, wait
  // for the limiter's Retry-After instead of failing the whole run.
  let lastStatus = 'no response';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loginResponse = await demoLoginRequest();
    if (loginResponse.ok) {
      const cookie = (loginResponse.headers.getSetCookie?.() ?? []).map(
        (header) => header.split(';')[0],
      );
      return cookie.join('; ');
    }
    lastStatus = `HTTP ${loginResponse.status}`;
    if (loginResponse.status === 429) {
      const retryAfter = Number(
        loginResponse.headers.get('retry-after') ?? '5',
      );
      const waitMs = (Number.isFinite(retryAfter) ? retryAfter : 5) * 1000;
      console.error(
        `rate limiter busy; waiting ${Math.ceil(waitMs / 1000)}s before retrying the bootstrap login`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs + 1000));
      continue;
    }
    break;
  }
  console.error(
    `Demo login failed (${lastStatus}). Is the API running ` +
      `with DEMO_MODE=true and the seeded demo organization?`,
  );
  process.exit(1);
}

async function main() {
  if (rateLimitCheck) {
    const result = await runWorkload('demo-login', requests, demoLoginRequest);
    const counts = result.statuses.reduce((acc, status) => {
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const unexpected = result.statuses.filter(
      (status) => status !== 200 && status !== 429,
    );
    if (jsonOutput) {
      console.log(
        JSON.stringify({ rateLimitCheck: true, counts, unexpected }, null, 2),
      );
    } else {
      console.log(
        `Rate-limit check against ${API_URL}: ${result.requests} demo-login requests`,
      );
      console.log(
        `  200 (allowed): ${counts[200] ?? 0}   429 (limited): ${counts[429] ?? 0}`,
      );
      if (unexpected.length > 0) {
        console.log(
          `  unexpected statuses: ${[...new Set(unexpected)].join(', ')}`,
        );
      }
    }
    if (unexpected.length > 0) {
      console.error(`FAIL: unexpected statuses observed (${unexpected[0]}).`);
      process.exit(1);
    }
    if ((counts[429] ?? 0) === 0) {
      console.error(
        'FAIL: no 429 observed. The public-write limiter is not enforcing ' +
          'the 60/min threshold (check TRUSTED_PROXY_CIDRS and the guard).',
      );
      process.exit(1);
    }
    console.log('OK: limiter returned 429 after the threshold as designed.');
    process.exit(0);
  }

  // Authenticate once: demo-login sets an HttpOnly session cookie that the
  // read workloads replay. The rate limiter counts this single request.
  const cookieHeader = await authenticate();
  const authHeaders = {
    cookie: cookieHeader,
    'Content-Type': 'application/json',
  };

  const results = [
    await runWorkload('orders-list', requests, () =>
      fetch(`${API_URL}/v1/orders?page=1&pageSize=25&search=`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ),
    await runWorkload('balances-list', requests, () =>
      fetch(`${API_URL}/v1/inventory/balances?page=1&pageSize=25`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ),
  ];

  if (includeWrites) {
    const writeRequests = Math.min(requests, WRITE_WORKLOAD_REQUEST_CAP);
    results.push(
      await runWorkload('demo-login', writeRequests, demoLoginRequest),
    );
  }

  const failed = results.filter((result) => result.errors > 0);
  const anyFailed = failed.length > 0;

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          apiUrl: API_URL,
          concurrency,
          ranAt: new Date().toISOString(),
          results,
          failed: anyFailed,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `API: ${API_URL}  concurrency: ${concurrency}  requests per workload: ${requests}`,
    );
    if (includeWrites) {
      console.log(
        `note: demo-login capped at ${WRITE_WORKLOAD_REQUEST_CAP} requests to stay under the 60/min public-write limiter`,
      );
    }
    console.log(
      [
        'workload',
        'requests',
        'req/s',
        'p50 ms',
        'p90 ms',
        'p95 ms',
        'p99 ms',
        'errors',
      ].join('  '),
    );
    for (const result of results) console.log(formatRow(result));
    if (anyFailed) {
      console.log('\nErrors observed:');
      for (const result of failed) {
        console.log(`  ${result.name}: ${result.firstError}`);
      }
    } else {
      console.log('\nNo errors observed.');
    }
  }

  process.exit(anyFailed ? 1 : 0);
}

void main();
