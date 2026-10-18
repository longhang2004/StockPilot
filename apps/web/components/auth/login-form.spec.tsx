import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCsrfToken } from '../../lib/api-client';
import { LoginForm } from './login-form';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      code: 'UNAUTHORIZED',
      detail: 'Email or password is incorrect.',
      instance: '/v1/auth/login',
      status: 401,
      title: 'Unauthorized',
      traceId: 'trace',
      type: 'https://stockpilot.dev/problems/unauthorized',
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 401 },
  );
}

function unavailableResponse() {
  return new Response(
    JSON.stringify({
      code: 'INTERNAL_ERROR',
      detail: 'Internal error.',
      instance: '/v1/auth/login',
      status: 503,
      title: 'Service unavailable',
      traceId: 'trace',
      type: 'https://stockpilot.dev/problems/internal-error',
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 503 },
  );
}

function csrfUnauthorizedResponse() {
  return new Response(JSON.stringify({ detail: 'Authentication required.' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 401,
  });
}

describe('LoginForm', () => {
  const replace = vi.fn();
  const refresh = vi.fn();

  beforeEach(() => {
    clearCsrfToken();
    vi.mocked(useRouter).mockReturnValue({ replace, refresh } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input).includes('/auth/csrf')) {
          return Promise.resolve(csrfUnauthorizedResponse());
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              csrfToken: 'session-token',
              membership: { id: 'membership-1' },
              user: { displayName: 'Account User' },
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
    vi.clearAllMocks();
    clearCsrfToken();
  });

  async function fillAndSubmit() {
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'account@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'safe-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('routes an existing member into the workspace', async () => {
    const view = render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
    expect(refresh).toHaveBeenCalledOnce();
    const loginCall = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => String(input).includes('/auth/login'));
    expect(
      JSON.parse(String((loginCall?.[1] as RequestInit | undefined)?.body)),
    ).toEqual({ email: 'account@example.test', password: 'safe-password' });
    view.unmount();
  });

  it('routes an account without a workspace to workspace creation', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/csrf')) {
        return Promise.resolve(csrfUnauthorizedResponse());
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            csrfToken: 'token',
            membership: null,
            user: { displayName: 'New' },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    });
    const view = render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/create-workspace'),
    );
    view.unmount();
  });

  it('shows a generic invalid-credentials error and restores the form', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).includes('/auth/csrf')
          ? csrfUnauthorizedResponse()
          : unauthorizedResponse(),
      ),
    );
    const view = render(<LoginForm />);
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.',
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
    view.unmount();
  });

  it('distinguishes temporary service failures from invalid credentials', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).includes('/auth/csrf')
          ? csrfUnauthorizedResponse()
          : unavailableResponse(),
      ),
    );
    const view = render(<LoginForm />);
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Sign-in is temporarily unavailable/,
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(/incorrect/i);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    view.unmount();
  });
});
