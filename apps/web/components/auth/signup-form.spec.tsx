import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouter } from 'next/navigation';

import { SignupForm } from './signup-form';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

function problemResponse(code: string, detail: string, status: number) {
  return new Response(
    JSON.stringify({
      code,
      detail,
      instance: '/v1/auth/signup',
      status,
      title: 'Conflict',
      traceId: 'trace',
      type: `https://stockpilot.dev/problems/${code.toLowerCase()}`,
    }),
    { headers: { 'Content-Type': 'application/json' }, status },
  );
}

describe('SignupForm', () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            csrfToken: 'token',
            membership: null,
            user: { displayName: 'New User' },
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 201 },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('submits the account and routes to workspace creation', async () => {
    const fetchMock = vi.mocked(fetch);
    const view = render(<SignupForm />);

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'New User' },
    });
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longenoughpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/create-workspace'));
    const signupCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/auth/signup'),
    );
    expect(
      JSON.parse(String((signupCall?.[1] as RequestInit | undefined)?.body)),
    ).toEqual({
      displayName: 'New User',
      email: 'new@example.test',
      password: 'longenoughpass',
    });
    view.unmount();
  });

  it('surfaces a friendly message for an existing account', async () => {
    vi.mocked(fetch).mockResolvedValue(
      problemResponse('EMAIL_ALREADY_REGISTERED', 'An account exists.', 409),
    );
    const view = render(<SignupForm />);

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'New User' },
    });
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longenoughpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already exists/i,
    );
    expect(push).not.toHaveBeenCalled();
    view.unmount();
  });
});
