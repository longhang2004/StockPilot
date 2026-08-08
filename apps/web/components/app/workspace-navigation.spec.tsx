import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DemoRoleSwitcher } from './workspace-navigation';

describe('DemoRoleSwitcher', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/csrf')) {
          return Promise.resolve(
            new Response(JSON.stringify({ csrfToken: 'test-token' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              membership: { organization: { name: 'Demo' }, role: 'STAFF' },
              user: { displayName: 'Demo Staff' },
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('switches the demo role through the server-side demo login', async () => {
    const fetchMock = vi.mocked(fetch);
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign },
    });

    const view = render(<DemoRoleSwitcher currentRole="MANAGER" />);

    expect(screen.getByLabelText('Switch demo role')).toHaveValue('MANAGER');
    fireEvent.change(screen.getByLabelText('Switch demo role'), {
      target: { value: 'STAFF' },
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes('/auth/demo-login') &&
            (init as RequestInit | undefined)?.method === 'POST',
        ),
      ).toBe(true);
    });
    const loginCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/auth/demo-login'),
    );
    expect(
      JSON.parse(String((loginCall?.[1] as RequestInit | undefined)?.body)),
    ).toEqual({ role: 'STAFF' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/app'));
    view.unmount();
  });
});
