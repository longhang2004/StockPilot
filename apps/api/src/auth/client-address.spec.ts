import { describe, expect, it } from 'vitest';

import { resolveClientAddress } from './client-address.js';

const IPV4_PROXIES = '10.0.0.0/8';
const IPV6_PROXIES = '2001:db8::/32';
const MIXED_PROXIES = '10.0.0.0/8, 2001:db8::/32';

describe('resolveClientAddress', () => {
  it('uses the socket peer and ignores X-Forwarded-For with no trusted proxies', () => {
    const result = resolveClientAddress(
      '203.0.113.9',
      '203.0.113.1, 198.51.100.2',
      undefined,
    );
    expect(result).toEqual({ address: '203.0.113.9', source: 'socket' });
  });

  it('uses the socket peer when the socket is not a trusted proxy', () => {
    const result = resolveClientAddress(
      '198.51.100.7',
      '203.0.113.1, 10.0.0.5',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '198.51.100.7', source: 'socket' });
  });

  it('resolves the client through one trusted proxy (IPv4)', () => {
    // XFF: client, proxy1 -- socket is proxy1.
    const result = resolveClientAddress(
      '10.0.0.1',
      '203.0.113.50, 10.0.0.1',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '203.0.113.50', source: 'forwarded' });
  });

  it('resolves the client through multiple trusted proxies', () => {
    // XFF: client, proxy1, proxy2 -- socket is proxy3.
    const result = resolveClientAddress(
      '10.0.0.3',
      '203.0.113.50, 10.0.0.1, 10.0.0.2',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '203.0.113.50', source: 'forwarded' });
  });

  it('ignores attacker-prepended spoofed XFF entries', () => {
    // Attacker (untrusted) prepends a spoofed address; the walk starts at
    // the right and stops at the attacker's real address.
    const result = resolveClientAddress(
      '10.0.0.3',
      '6.6.6.6, 203.0.113.50, 10.0.0.1, 10.0.0.2',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '203.0.113.50', source: 'forwarded' });
  });

  it('returns the socket peer when the entire chain is trusted', () => {
    const result = resolveClientAddress(
      '10.0.0.3',
      '10.0.0.1, 10.0.0.2',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '10.0.0.3', source: 'socket' });
  });

  it('returns the socket peer when X-Forwarded-For is absent', () => {
    const result = resolveClientAddress('10.0.0.3', undefined, IPV4_PROXIES);
    expect(result).toEqual({ address: '10.0.0.3', source: 'socket' });
  });

  it('handles IPv6 clients behind IPv6 trusted proxies', () => {
    const result = resolveClientAddress(
      '2001:db8::3',
      '2001:4860:4860::8888, 2001:db8::1, 2001:db8::2',
      IPV6_PROXIES,
    );
    expect(result).toEqual({
      address: '2001:4860:4860::8888',
      source: 'forwarded',
    });
  });

  it('handles IPv4-mapped IPv6 socket peers and hops', () => {
    const result = resolveClientAddress(
      '::ffff:10.0.0.3',
      '203.0.113.50, ::ffff:10.0.0.1, ::ffff:10.0.0.2',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '203.0.113.50', source: 'forwarded' });
  });

  it('treats a malformed hop as the nearest untrusted address', () => {
    const result = resolveClientAddress(
      '10.0.0.2',
      '10.0.0.1, not-an-ip, 10.0.0.2',
      IPV4_PROXIES,
    );
    // Rightmost trusted hop (10.0.0.2) is skipped; "not-an-ip" cannot be a
    // trusted proxy, so the walk stops there.
    expect(result).toEqual({ address: 'not-an-ip', source: 'forwarded' });
  });

  it('skips empty forwarding segments', () => {
    const result = resolveClientAddress(
      '10.0.0.2',
      '203.0.113.50, , 10.0.0.2',
      IPV4_PROXIES,
    );
    expect(result).toEqual({ address: '203.0.113.50', source: 'forwarded' });
  });

  it('matches IPv6 hops against IPv4 CIDRs via mapped form', () => {
    const result = resolveClientAddress(
      '::ffff:10.0.0.2',
      '203.0.113.50, ::ffff:10.0.0.1',
      MIXED_PROXIES,
    );
    expect(result).toEqual({ address: '203.0.113.50', source: 'forwarded' });
  });
});
