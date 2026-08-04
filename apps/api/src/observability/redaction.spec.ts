import { describe, expect, it } from 'vitest';

describe('redactRecord', () => {
  it('masks security and database secrets recursively without mutating input', async () => {
    const { redactRecord } = await import('./redaction.js');
    const input = {
      authorization: 'Bearer secret',
      nested: {
        cookie: 'session=secret',
        safe: 'visible',
      },
      queue_database_url: 'postgresql://queue:secret@db/queue',
      safe: 'visible',
    };

    expect(redactRecord(input)).toEqual({
      authorization: '[REDACTED]',
      nested: {
        cookie: '[REDACTED]',
        safe: 'visible',
      },
      queue_database_url: '[REDACTED]',
      safe: 'visible',
    });
    expect(input.nested.cookie).toBe('session=secret');
  });
});
