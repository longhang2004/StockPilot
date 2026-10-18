import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('StockPilot public page', () => {
  it('explains the product and offers the manager demo first', async () => {
    const { default: HomePage } = await import('./page');

    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /inventory and b2b order operations/i,
      }),
    ).toBeInTheDocument();
    const managerLinks = screen.getAllByRole('link', {
      name: /enter manager demo/i,
    });
    expect(managerLinks).toHaveLength(1);
    expect(managerLinks[0]).toHaveAttribute('href', '/login?role=manager');
    expect(
      screen.getByRole('heading', { name: 'Inventory worklist' }),
    ).toBeVisible();
    expect(screen.getByText('Illustrative data')).toBeVisible();
    expect(
      screen.getByRole('table', {
        name: 'Illustrative inventory worklist rows',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/seeded data/i)).toBeVisible();
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent?.trim()),
    ).toEqual([
      'Open a role-based demo',
      'Inventory worklist',
      'From receipt to fulfillment',
      'Operational controls',
    ]);
    expect(
      screen.getByRole('link', { name: /skip to content/i }),
    ).toHaveAttribute('href', '#main-content');
    expect(
      screen.getByRole('link', {
        name: /view the source and technical documentation/i,
      }),
    ).toHaveAttribute('href', 'https://github.com/longhang2004/StockPilot');
  });
});
