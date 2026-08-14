import { describe, expect, it } from 'vitest';

import { parseCidrs } from './cidr.js';

describe('parseCidrs', () => {
  it('matches IPv4 addresses inside the prefix', () => {
    const [matcher] = parseCidrs('10.0.0.0/8');
    expect(matcher!.contains('10.1.2.3')).toBe(true);
    expect(matcher!.contains('10.255.255.255')).toBe(true);
    expect(matcher!.contains('11.0.0.1')).toBe(false);
    expect(matcher!.contains('192.168.1.1')).toBe(false);
  });

  it('matches a single IPv4 address when no prefix is given', () => {
    const [matcher] = parseCidrs('192.168.1.1');
    expect(matcher!.contains('192.168.1.1')).toBe(true);
    expect(matcher!.contains('192.168.1.2')).toBe(false);
  });

  it('matches IPv6 addresses inside the prefix', () => {
    const [matcher] = parseCidrs('2001:db8::/32');
    expect(matcher!.contains('2001:db8::1')).toBe(true);
    expect(matcher!.contains('2001:db8:ffff::1')).toBe(true);
    expect(matcher!.contains('2001:db9::1')).toBe(false);
  });

  it('handles IPv4-mapped IPv6 peers', () => {
    const [matcher] = parseCidrs('10.0.0.0/8');
    expect(matcher!.contains('::ffff:10.1.2.3')).toBe(true);
    expect(matcher!.contains('::ffff:11.0.0.1')).toBe(false);
  });

  it('parses a comma-separated list', () => {
    const matchers = parseCidrs('10.0.0.0/8, 2001:db8::/32, 192.168.0.1');
    expect(matchers).toHaveLength(3);
    expect(matchers[0]!.contains('10.0.0.1')).toBe(true);
    expect(matchers[1]!.contains('2001:db8::1')).toBe(true);
    expect(matchers[2]!.contains('192.168.0.1')).toBe(true);
  });

  it('skips malformed entries without throwing', () => {
    const matchers = parseCidrs(
      'not-an-ip, 999.1.1.1/8, 10.0.0.0/33, 10.0.0.0/8',
    );
    expect(matchers).toHaveLength(1);
    expect(matchers[0]!.contains('10.1.1.1')).toBe(true);
  });

  it('returns an empty list for empty or missing input', () => {
    expect(parseCidrs(undefined)).toEqual([]);
    expect(parseCidrs('')).toEqual([]);
    expect(parseCidrs('   ')).toEqual([]);
  });
});
