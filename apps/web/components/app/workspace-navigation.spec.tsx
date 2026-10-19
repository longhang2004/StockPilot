import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouter } from 'next/navigation';

import { clearCsrfToken } from '../../lib/api-client';
import {
  DemoRoleSwitcher,
  WorkspaceSidebar,
  WorkspaceSignOut,
} from './workspace-navigation';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('WorkspaceSidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes a discoverable Owner settings entry with active state', () => {
    render(<WorkspaceSidebar role="OWNER" section="settings" />);
    const link = screen.getByRole('link', { name: 'Settings' });
    expect(link).toHaveAttribute('href', '/app/settings');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Settings out of Manager and Staff navigation', () => {
    const { rerender, unmount } = render(
      <WorkspaceSidebar role="MANAGER" section="orders" />,
    );
    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    rerender(<WorkspaceSidebar role="STAFF" section="orders" />);
    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    unmount();
  });
});

describe('DemoRoleSwitcher', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.mocked(useRouter).mockReturnValue({
      replace: vi.fn(),
      refresh: vi.fn(),
    } as never);
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
    vi.clearAllMocks();
    clearCsrfToken();
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

describe('WorkspaceSignOut', () => {
  const replace = vi.fn();
  const refresh = vi.fn();

  beforeEach(() => {
    clearCsrfToken();
    vi.mocked(useRouter).mockReturnValue({ replace, refresh } as never);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearCsrfToken();
  });

  it('sends CSRF-protected logout and returns to sign in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).includes('/auth/csrf')
            ? new Response(JSON.stringify({ csrfToken: 'logout-token' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
              })
            : new Response(null, { status: 204 }),
        ),
      ),
    );

    render(<WorkspaceSignOut />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(refresh).toHaveBeenCalledOnce();
    const logoutCall = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => String(input).includes('/auth/logout'));
    const request = logoutCall?.[1] as RequestInit | undefined;
    expect(request?.method).toBe('POST');
    expect(new Headers(request?.headers).get('X-CSRF-Token')).toBe(
      'logout-token',
    );
  });

  it('shows a retryable error if logout does not complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).includes('/auth/csrf')
            ? new Response(JSON.stringify({ csrfToken: 'logout-token' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
              })
            : new Response('unavailable', { status: 503 }),
        ),
      ),
    );

    render(<WorkspaceSignOut />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Sign out did not complete/,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});
