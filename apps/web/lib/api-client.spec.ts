import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, clearCsrfToken } from './api-client';

describe('apiRequest', () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it('lets the browser set the multipart boundary for FormData', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'product-1' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const body = new FormData();
    body.append(
      'file',
      new File(['image'], 'product.webp', { type: 'image/webp' }),
    );
    await apiRequest<{ id: string }>('/products/product-1/image', {
      body,
      method: 'POST',
    });

    const requestHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(requestHeaders.get('Content-Type')).toBeNull();
    expect(requestHeaders.get('X-CSRF-Token')).toBe('csrf-token');
  });

  it('adopts the rotated CSRF token from session-creating responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        // GET /auth/csrf for the pre-organization signup session.
        new Response(JSON.stringify({ csrfToken: 'signup-token' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        // POST /organizations rotates the session and returns the new token.
        new Response(
          JSON.stringify({ csrfToken: 'rotated-token', membership: {} }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        // A later authenticated write must send the rotated token without
        // refetching /auth/csrf against the now-current session.
        new Response(JSON.stringify({ id: 'o-1' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest<{ membership: unknown }>('/organizations', {
      body: JSON.stringify({ name: 'Rotating Workspace' }),
      method: 'POST',
    });
    await apiRequest<{ id: string }>('/workspaces/example', {
      body: JSON.stringify({ name: 'example' }),
      method: 'POST',
    });

    const rotationHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(rotationHeaders.get('X-CSRF-Token')).toBe('signup-token');
    const followUpHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(followUpHeaders.get('X-CSRF-Token')).toBe('rotated-token');
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('/auth/csrf'),
      ),
    ).toHaveLength(1);
  });
});
