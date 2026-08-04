import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('DemoLoginCard', () => {
  beforeEach(() => {
    push.mockReset();
    vi.unstubAllGlobals();
  });

  it('logs in with the selected role and opens the workspace', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          csrfToken: 'csrf-token',
          membership: { role: 'MANAGER' },
          user: { displayName: 'Morgan Manager' },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { DemoLoginCard } = await import('./demo-login-card');

    render(<DemoLoginCard initialRole="MANAGER" />);
    fireEvent.click(
      screen.getByRole('button', { name: /continue as manager/i }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith('/app'));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/demo-login', {
      body: JSON.stringify({ role: 'MANAGER' }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('shows an actionable message when the demo session cannot start', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Demo account is unavailable.' }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 401,
          },
        ),
      ),
    );
    const { DemoLoginCard } = await import('./demo-login-card');

    render(<DemoLoginCard initialRole="STAFF" />);
    fireEvent.click(screen.getByRole('button', { name: /continue as staff/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not start the demo/i,
    );
    expect(push).not.toHaveBeenCalled();
  });
});
