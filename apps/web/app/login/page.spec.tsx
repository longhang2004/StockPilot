import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import LoginPage from './page';

describe('LoginPage', () => {
  afterEach(() => cleanup());

  it('shows account sign-in on the plain route', async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByLabelText('Work email')).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open demo' })).toHaveAttribute(
      'href',
      '/login?role=manager',
    );
  });

  it('keeps a valid role query on the demo sign-in flow', async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({ role: 'staff' }),
    });
    render(page);

    expect(
      screen.getByRole('button', { name: /continue as staff/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Sign in to an account' }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('Work email')).not.toBeInTheDocument();
  });
});
