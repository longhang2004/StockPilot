import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('WorkspaceShell', () => {
  beforeEach(() => {
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

    render(<WorkspaceShell />);

    expect(await screen.findByText('Morgan Manager')).toBeVisible();
    expect(screen.getByText('Manager')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /operations overview/i }),
    ).toBeVisible();
  });

  it('offers a clear return path when the session has expired', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const { WorkspaceShell } = await import('./workspace-shell');

    render(<WorkspaceShell />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /session has expired/i,
    );
    expect(
      screen.getByRole('link', { name: /return to demo login/i }),
    ).toHaveAttribute('href', '/login');
  });
});
