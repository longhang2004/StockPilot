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
});
