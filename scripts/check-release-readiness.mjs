#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;

function describe(payload, statusCode) {
  const status =
    typeof payload?.status === 'string' ? payload.status : 'unknown';
  const revision =
    typeof payload?.revision === 'string' ? payload.revision : 'unknown';
  const database =
    typeof payload?.checks?.database === 'string'
      ? payload.checks.database
      : 'unknown';
  const queue =
    typeof payload?.checks?.queue === 'string'
      ? payload.checks.queue
      : 'unknown';
  return `HTTP ${statusCode}, status=${status}, revision=${revision}, database=${database}, queue=${queue}`;
}

export async function waitForReleaseReadiness({
  url,
  expectedRevision,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!url) throw new Error('API readiness URL is required.');
  if (!expectedRevision)
    throw new Error('Expected commit revision is required.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Readiness timeout must be a positive number.');
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new Error('Readiness poll interval must be a positive number.');
  }

  const deadline = now() + timeoutMs;
  let lastObservation = 'no response received';

  while (now() < deadline) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await response.json();
      lastObservation = describe(payload, response.status);

      if (
        response.ok &&
        payload?.status === 'ready' &&
        payload?.checks?.database === 'ok' &&
        payload?.revision === expectedRevision
      ) {
        return {
          revision: payload.revision,
          checks: payload.checks,
          status: payload.status,
        };
      }
    } catch (error) {
      lastObservation = `request failed (${error?.name ?? 'Error'})`;
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(pollIntervalMs, remainingMs));
  }

  throw new Error(
    `Timed out waiting for API readiness at the expected revision ${expectedRevision}; last observation: ${lastObservation}.`,
  );
}

async function main() {
  const url = process.env.API_HEALTH_READY_URL;
  const expectedRevision = process.env.EXPECTED_REVISION;
  const timeoutMs = Number(
    process.env.READINESS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );

  if (!url) throw new Error('API_HEALTH_READY_URL is required.');
  if (new URL(url).protocol !== 'https:') {
    throw new Error('API_HEALTH_READY_URL must use HTTPS.');
  }

  const result = await waitForReleaseReadiness({
    url,
    expectedRevision,
    timeoutMs,
  });
  console.log(
    `API ready at revision ${result.revision}; database ${result.checks.database}; queue ${result.checks.queue}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
