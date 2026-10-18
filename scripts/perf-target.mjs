const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function validatePerformanceTarget(apiUrl, args, env) {
  let target;
  try {
    target = new URL(apiUrl);
  } catch {
    throw new Error('API_URL must be a complete HTTP(S) URL.');
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('API_URL must use HTTP or HTTPS.');
  }
  if (target.username || target.password) {
    throw new Error('API_URL must not contain credentials.');
  }
  if (target.pathname !== '/' || target.search || target.hash) {
    throw new Error(
      'API_URL must be an origin without a path, query, or fragment.',
    );
  }

  const isLoopback =
    LOOPBACK_HOSTS.has(target.hostname) || target.hostname.startsWith('127.');
  if (isLoopback) return { hostname: target.hostname, isLoopback: true };

  if (
    !args.includes('--allow-staging') ||
    env.PERF_TARGET !== 'staging' ||
    env.PERF_TARGET_HOST !== target.hostname ||
    env.PERF_TARGET_ACKNOWLEDGEMENT !==
      `I_CONFIRM_${target.hostname}_IS_DISPOSABLE_STAGING`
  ) {
    throw new Error(
      'Remote performance targets are blocked by default. Staging requires --allow-staging plus PERF_TARGET=staging, an exact PERF_TARGET_HOST match, and the host-specific PERF_TARGET_ACKNOWLEDGEMENT.',
    );
  }

  if (
    args.includes('--include-writes') ||
    args.includes('--rate-limit-check')
  ) {
    throw new Error(
      'Remote staging runs are read-only; write and rate-limit workloads are disabled.',
    );
  }

  return { hostname: target.hostname, isLoopback: false };
}
