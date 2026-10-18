import assert from 'node:assert/strict';
import test from 'node:test';

import { waitForReleaseReadiness } from './check-release-readiness.mjs';

const url = 'https://api.example.test/v1/health/ready';
const expectedRevision = 'a'.repeat(40);

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('accepts only ready database response at expected revision', async () => {
  const result = await waitForReleaseReadiness({
    url,
    expectedRevision,
    fetchImpl: async () =>
      response({
        checks: { database: 'ok', queue: 'not_configured' },
        revision: expectedRevision,
        status: 'ready',
      }),
  });

  assert.equal(result.revision, expectedRevision);
  assert.equal(result.checks.queue, 'not_configured');
});

test('waits through an old revision until the requested revision is live', async () => {
  const revisions = ['b'.repeat(40), expectedRevision];
  let clock = 0;
  const result = await waitForReleaseReadiness({
    url,
    expectedRevision,
    timeoutMs: 20,
    pollIntervalMs: 10,
    now: () => clock,
    sleep: async (ms) => (clock += ms),
    fetchImpl: async () =>
      response({
        checks: { database: 'ok', queue: 'not_configured' },
        revision: revisions.shift(),
        status: 'ready',
      }),
  });

  assert.equal(result.revision, expectedRevision);
});

test('waits through degraded dependency readiness', async () => {
  let clock = 0;
  let calls = 0;
  const result = await waitForReleaseReadiness({
    url,
    expectedRevision,
    timeoutMs: 20,
    pollIntervalMs: 10,
    now: () => clock,
    sleep: async (ms) => (clock += ms),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? response(
            {
              checks: { database: 'unavailable', queue: 'not_configured' },
              revision: expectedRevision,
              status: 'degraded',
            },
            503,
          )
        : response({
            checks: { database: 'ok', queue: 'not_configured' },
            revision: expectedRevision,
            status: 'ready',
          });
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.checks.database, 'ok');
});

test('times out with the last observation and without echoing the URL', async () => {
  let clock = 0;
  await assert.rejects(
    waitForReleaseReadiness({
      url,
      expectedRevision,
      timeoutMs: 15,
      pollIntervalMs: 10,
      now: () => clock,
      sleep: async (ms) => (clock += ms),
      fetchImpl: async () =>
        response(
          {
            checks: { database: 'unavailable', queue: 'not_configured' },
            revision: 'b'.repeat(40),
            status: 'degraded',
          },
          503,
        ),
    }),
    (error) => {
      assert.match(error.message, /Timed out waiting for API readiness/);
      assert.match(error.message, /HTTP 503, status=degraded/);
      assert.doesNotMatch(error.message, /api\.example\.test/);
      return true;
    },
  );
});
