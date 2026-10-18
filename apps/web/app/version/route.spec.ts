import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('/version route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the web build revision without caching or indexing the endpoint', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'web-build-sha');
    vi.stubEnv('WEB_REVISION', 'docker-build-sha');

    const response = await GET();

    expect(await response.json()).toEqual({
      revision: 'web-build-sha',
      service: 'stockpilot-web',
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
