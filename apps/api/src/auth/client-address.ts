/**
 * Client-address resolution for the public-write rate limiter.
 *
 * Trust semantics (see docs/operations.md):
 *
 *   X-Forwarded-For: client, proxy1, proxy2        (leftmost = original)
 *   socket.remoteAddress = proxy3                  (nearest hop to the app)
 *
 * Each trusted reverse proxy appends the previous hop, so the nearest hop
 * is the RIGHTMOST entry. The effective client is therefore found by
 * walking the chain RIGHT TO LEFT, skipping hops that are themselves
 * trusted proxies, and stopping at the FIRST untrusted hop. This makes it
 * impossible for an attacker-controlled left-side value to override a
 * legitimate nearer untrusted address (an attacker can only prepend).
 *
 * Rules:
 * - With no TRUSTED_PROXY_CIDRS configured: the socket peer is always the
 *   client; X-Forwarded-For is never inspected (it is attacker-controlled
 *   at the public edge).
 * - With trusted proxies configured but the socket peer NOT among them:
 *   the socket peer is the client; X-Forwarded-For is never inspected.
 * - With a trusted socket peer: the chain is walked right-to-left; the
 *   first hop that is not a trusted proxy (including malformed values,
 *   which cannot be trusted proxies) is the effective client.
 * - If every hop is trusted (or no X-Forwarded-For header exists), the
 *   socket peer is the effective client.
 */
import { parseCidrs } from './cidr.js';

export interface ClientAddressResolution {
  address: string;
  /** How the address was derived, for tests and diagnostics. */
  source: 'socket' | 'forwarded';
}

export function resolveClientAddress(
  socketAddress: string | undefined,
  forwardedFor: string | undefined,
  trustedProxyCidrs: string | undefined,
): ClientAddressResolution {
  const socket = socketAddress?.trim() || 'unknown';

  const trustedProxies = parseCidrs(trustedProxyCidrs);
  if (trustedProxies.length === 0) {
    return { address: socket, source: 'socket' };
  }
  if (!trustedProxies.some((proxy) => proxy.contains(socket))) {
    return { address: socket, source: 'socket' };
  }
  if (!forwardedFor) {
    return { address: socket, source: 'socket' };
  }

  const hops = forwardedFor
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);

  // Walk from the hop nearest the application (rightmost) leftward while
  // hops are trusted. The first untrusted hop is the effective client.
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    const hop = hops[index];
    if (hop === undefined) {
      continue;
    }
    if (trustedProxies.some((proxy) => proxy.contains(hop))) {
      continue;
    }
    return { address: hop, source: 'forwarded' };
  }

  // Every hop is trusted: the socket peer is the effective client.
  return { address: socket, source: 'socket' };
}
