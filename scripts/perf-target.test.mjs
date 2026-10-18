import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePerformanceTarget } from './perf-target.mjs';

test('allows loopback targets without a remote acknowledgement', () => {
  assert.equal(
    validatePerformanceTarget('http://127.0.0.1:4300', [], {}).isLoopback,
    true,
  );
  assert.equal(
    validatePerformanceTarget('http://[::1]:4300', [], {}).isLoopback,
    true,
  );
});

test('blocks public targets unless the disposable staging host is explicit', () => {
  assert.throws(
    () => validatePerformanceTarget('https://stockpilot.example', [], {}),
    /Remote performance targets are blocked by default/,
  );

  const host = 'stockpilot-staging.example';
  const result = validatePerformanceTarget(
    `https://${host}`,
    ['--allow-staging'],
    {
      PERF_TARGET: 'staging',
      PERF_TARGET_HOST: host,
      PERF_TARGET_ACKNOWLEDGEMENT: `I_CONFIRM_${host}_IS_DISPOSABLE_STAGING`,
    },
  );
  assert.equal(result.isLoopback, false);
});

test('rejects staging acknowledgement for a different host and all remote writes', () => {
  const host = 'stockpilot-staging.example';
  const env = {
    PERF_TARGET: 'staging',
    PERF_TARGET_HOST: host,
    PERF_TARGET_ACKNOWLEDGEMENT: `I_CONFIRM_${host}_IS_DISPOSABLE_STAGING`,
  };
  assert.throws(
    () => validatePerformanceTarget(`https://${host}`, [], env),
    /Remote performance targets are blocked by default/,
  );
  assert.throws(
    () =>
      validatePerformanceTarget(`https://${host}`, ['--allow-staging'], {
        ...env,
        PERF_TARGET_ACKNOWLEDGEMENT:
          'I_CONFIRM_PRODUCTION_IS_DISPOSABLE_STAGING',
      }),
    /Remote performance targets are blocked by default/,
  );
  assert.throws(
    () =>
      validatePerformanceTarget(
        `https://${host}`,
        ['--allow-staging', '--include-writes'],
        env,
      ),
    /Remote staging runs are read-only/,
  );
  assert.throws(
    () =>
      validatePerformanceTarget(
        `https://${host}`,
        ['--allow-staging', '--rate-limit-check'],
        env,
      ),
    /Remote staging runs are read-only/,
  );
});

test('rejects non-HTTP schemes and embedded credentials', () => {
  assert.throws(
    () => validatePerformanceTarget('ftp://localhost:4300', [], {}),
    /must use HTTP or HTTPS/,
  );
  assert.throws(
    () => validatePerformanceTarget('https://user:pass@localhost:4300', [], {}),
    /must not contain credentials/,
  );
  assert.throws(
    () => validatePerformanceTarget('https://example.com?token=secret', [], {}),
    /without a path, query, or fragment/,
  );
});
