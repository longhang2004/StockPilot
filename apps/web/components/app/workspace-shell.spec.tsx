import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WorkspaceShell', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the authenticated operator and their role boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            membership: {
              organization: {
                currency: 'USD',
                name: 'Harbor & Pine Wholesale',
              },
              role: 'MANAGER',
            },
            user: { displayName: 'Morgan Manager' },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      ),
    );
    const { WorkspaceShell } = await import('./workspace-shell');

    const view = render(<WorkspaceShell />);

    expect(await screen.findByText('Morgan Manager')).toBeVisible();
    expect(screen.getByText('Manager')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /operations overview/i }),
    ).toBeVisible();
    view.unmount();
  });

  it('offers a clear return path when the session has expired', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const { WorkspaceShell } = await import('./workspace-shell');

    const view = render(<WorkspaceShell />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /session has expired/i,
    );
    expect(
      screen.getByRole('link', { name: /return to demo login/i }),
    ).toHaveAttribute('href', '/login');
    view.unmount();
  });

  it('routes membershipless sessions toward workspace creation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            membership: null,
            user: { displayName: 'Fresh Signup' },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      ),
    );
    const { WorkspaceShell } = await import('./workspace-shell');

    const view = render(<WorkspaceShell />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Create a workspace to become its Owner/i,
    );
    expect(
      screen.getByRole('link', { name: /create a workspace/i }),
    ).toHaveAttribute('href', '/create-workspace');
    view.unmount();
  });
});
