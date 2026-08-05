import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('StockPilot public page', () => {
  it('explains the product and offers the manager demo first', async () => {
    const { default: HomePage } = await import('./page');

    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /stock control, under control/i,
      }),
    ).toBeInTheDocument();
    const managerLinks = screen.getAllByRole('link', {
      name: /enter manager demo/i,
    });
    expect(managerLinks).toHaveLength(2);
    expect(managerLinks[0]).toHaveAttribute('href', '/login?role=manager');
    expect(screen.getByText(/built for small wholesale teams/i)).toBeVisible();
  });
});
