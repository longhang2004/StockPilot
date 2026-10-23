import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/marketing/logistics-map', () => ({
  LogisticsMap: () => null,
}));

describe('StockPilot public page', () => {
  it('offers working demo/signup routes and an accessible product tour', async () => {
    const { default: HomePage } = await import('./page');
    render(<HomePage />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Know your stock.*Keep orders moving/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Enter Manager demo/i }),
    ).toHaveAttribute('href', '/login?role=manager');
    expect(
      screen.getAllByRole('link', { name: /Create a workspace/i })[0],
    ).toHaveAttribute('href', '/signup');
    expect(
      screen.getByRole('link', { name: /Skip to content/i }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getByText(/Live demo · Seeded data/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
    expect(screen.getByRole('button', { name: 'Inventory' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('img', { name: /StockPilot Inventory/ }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Explore Inventory in the demo/i }),
    ).toHaveAttribute('href', '/login?role=manager');
  });
});
