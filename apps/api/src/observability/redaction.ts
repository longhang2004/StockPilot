const REDACTED = '[REDACTED]';
const SECRET_KEYS = new Set([
  'authorization',
  'cookie',
  'database_url',
  'migration_database_url',
  'queue_database_url',
  'x-csrf-token',
  'x-webhook-signature',
]);

export function redactRecord<T>(value: T): T {
  return redact(value, new WeakMap<object, unknown>()) as T;
}

function redact(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';

  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const item of value) output.push(redact(item, seen));
    return output;
  }

  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEYS.has(key.toLowerCase())
      ? REDACTED
      : redact(item, seen);
  }
  return output;
}
