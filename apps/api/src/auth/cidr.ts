/**
 * Minimal IPv4/IPv6 CIDR matching for the rate-limiter's proxy trust
 * decision. No dependency: the only caller needs "is this socket peer one of
 * our reverse proxies?" semantics, which is a handful of bit operations.
 *
 * All addresses are compared in a canonical 128-bit space: plain IPv4
 * addresses (and IPv4-mapped IPv6 forms such as ::ffff:10.0.0.1) are mapped
 * to the IPv4-mapped range, so one IPv4 matcher catches both spellings of
 * the same peer.
 */

export interface CidrMatcher {
  contains(address: string): boolean;
}

const IPV4_MAPPED_OFFSET = 0xffff00000000n;
const IPV6_MAX = (1n << 128n) - 1n;

function parseIpv4(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function parseIpv6(address: string): bigint | null {
  // Normalize an IPv4-mapped IPv6 address (::ffff:1.2.3.4) into the same
  // 128-bit space the IPv4 matcher uses.
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && mapped[1]) {
    const ipv4 = parseIpv4(mapped[1]);
    return ipv4 === null ? null : BigInt(ipv4) + IPV4_MAPPED_OFFSET;
  }
  const halves = address.toLowerCase().split('::');
  if (halves.length > 2) return null;
  const expand = (side: string | undefined): number[] | null => {
    if (!side || side === '') return [];
    const groups = side.split(':').map((group) => {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      return Number.parseInt(group, 16);
    });
    return groups.some((group) => group === null) ? null : (groups as number[]);
  };
  const left = expand(halves[0]);
  const right = expand(halves[1]);
  if (left === null || right === null) return null;
  if (halves.length === 2 && left.length + right.length > 8) return null;
  if (halves.length === 1 && left.length !== 8) return null;
  const groups = [
    ...left,
    ...new Array(8 - left.length - right.length).fill(0),
    ...right,
  ];
  if (groups.length !== 8) return null;
  let value = 0n;
  for (const group of groups) {
    value = (value << 16n) | BigInt(group);
  }
  return value;
}

/** Canonical 128-bit value for any accepted address spelling. */
function parseAddressValue(address: string): bigint | null {
  const ipv4 = parseIpv4(address);
  if (ipv4 !== null) return BigInt(ipv4) + IPV4_MAPPED_OFFSET;
  return parseIpv6(address);
}

function ipv4Range(
  prefix: string,
  prefixLength: number,
): { min: bigint; max: bigint } | null {
  const parsed = parseIpv4(prefix);
  if (parsed === null || prefixLength < 0 || prefixLength > 32) return null;
  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
  const min = (parsed & mask) >>> 0;
  const max = (min | ~mask) >>> 0;
  return {
    min: BigInt(min) + IPV4_MAPPED_OFFSET,
    max: BigInt(max) + IPV4_MAPPED_OFFSET,
  };
}

function ipv6Range(
  prefix: string,
  prefixLength: number,
): { min: bigint; max: bigint } | null {
  const parsed = parseIpv6(prefix);
  if (parsed === null || prefixLength < 0 || prefixLength > 128) return null;
  const mask =
    prefixLength === 0 ? 0n : (~0n << BigInt(128 - prefixLength)) & IPV6_MAX;
  const min = parsed & mask;
  const max = min | (~mask & IPV6_MAX);
  return { min, max };
}

/**
 * Parses a comma-separated CIDR list such as "10.0.0.0/8,2001:db8::/32".
 * Entries that do not parse are skipped so a typo cannot crash the guard;
 * the caller decides what an empty result means (no trusted proxies).
 */
export function parseCidrs(input: string | undefined): CidrMatcher[] {
  if (!input) return [];
  const matchers: CidrMatcher[] = [];
  for (const rawEntry of input.split(',')) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const [address, rawPrefix] = entry.split('/');
    if (!address) continue;
    const prefixLength = rawPrefix === undefined ? null : Number(rawPrefix);
    if (
      rawPrefix !== undefined &&
      (!Number.isInteger(prefixLength) || (prefixLength as number) < 0)
    ) {
      continue;
    }
    const range = address.includes(':')
      ? ipv6Range(address, prefixLength ?? 128)
      : ipv4Range(address, prefixLength ?? 32);
    if (!range) continue;
    matchers.push({
      contains: (candidate) => {
        const value = parseAddressValue(candidate);
        return value !== null && value >= range.min && value <= range.max;
      },
    });
  }
  return matchers;
}
