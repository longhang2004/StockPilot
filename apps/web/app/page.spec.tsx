import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('StockPilot public page', () => {
  it('explains the product and offers the manager demo first', async () => {
    const { default: HomePage } = await import('./page');

    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /inventory and b2b order operations, under control/i,
      }),
    ).toBeInTheDocument();
    const managerLinks = screen.getAllByRole('link', {
      name: /enter manager demo/i,
    });
    expect(managerLinks).toHaveLength(1);
    expect(managerLinks[0]).toHaveAttribute('href', '/login?role=manager');
    const exploreLinks = screen.getAllByRole('link', {
      name: /explore manager demo/i,
    });
    expect(exploreLinks).toHaveLength(2);
    expect(exploreLinks[0]).toHaveAttribute('href', '/login?role=manager');
    expect(screen.getAllByText(/small wholesale teams/i)[0]).toBeVisible();
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent?.trim()),
    ).toEqual([
      'Make the next action obvious.',
      'The details are where trust is built.',
      'A workflow that holds together.',
      'Boring guarantees are the feature.',
      'Choose a role. See the boundary.',
      'See the operation in motion.',
    ]);
    expect(
      screen.getByRole('link', { name: /skip to content/i }),
    ).toHaveAttribute('href', '#main-content');
    expect(
      screen.getByRole('link', { name: /view source on github/i }),
    ).toHaveAttribute('href', 'https://github.com/longhang2004/StockPilot');
    expect(
      screen.getByRole('link', { name: /^Architecture$/ }),
    ).toBeInTheDocument();
  });
});
