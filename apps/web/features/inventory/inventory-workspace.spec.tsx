import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { InventoryWorkspace } from './inventory-workspace';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('inventory list scope', () => {
  it('keeps global totals when alert status changes and sends balance search to the server', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const body = String(input).includes('/inventory/summary')
        ? { trackedSkus: 250, availableUnits: 7824, openAlerts: 137 }
        : { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 };
      return Promise.resolve(new Response(JSON.stringify(body)));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <InventoryWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    expect(await screen.findByText('7824')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Filter alerts'), {
      target: { value: 'RESOLVED' },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('status=RESOLVED'),
        ),
      ).toBe(true),
    );
    expect(screen.getByText('137')).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('Search SKU or product'), {
      target: { value: 'REMOTE-250' },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(
            '/inventory/balances?page=1&pageSize=25&search=REMOTE-250',
          ),
        ),
      ).toBe(true),
    );
    expect(screen.getByText('7824')).toBeVisible();
    expect(screen.getByText('250')).toBeVisible();
  });
});
