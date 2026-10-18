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
  window.history.replaceState(null, '', '/');
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

  it('loads a URL-selected SKU with current reservations and linked source history', async () => {
    window.history.replaceState(null, '', '/app/inventory?product=product-a');
    const trace = {
      product: {
        id: 'product-a',
        name: 'Gloves',
        sku: 'NTR-L',
        reorderPoint: 4,
      },
      balance: {
        warehouseId: 'warehouse-a',
        onHand: 20,
        reserved: 6,
        available: 14,
        updatedAt: '2026-10-17T00:00:00Z',
      },
      reservations: {
        items: [
          {
            id: 'line-a',
            orderId: 'order-a',
            orderNumber: 'SO-42',
            customerCompanyName: 'Acme',
            quantity: 6,
            confirmedAt: '2026-10-17T00:00:00Z',
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
      movements: {
        items: [
          {
            id: 'movement-a',
            organizationId: 'org-a',
            warehouseId: 'warehouse-a',
            productId: 'product-a',
            type: 'RECEIPT',
            quantityDelta: 20,
            onHandAfter: 20,
            referenceType: 'GOODS_RECEIPT',
            referenceId: 'receipt-a',
            reason: null,
            actorUserId: null,
            createdAt: '2026-10-17T00:00:00Z',
            product: { name: 'Gloves', sku: 'NTR-L' },
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/trace?')
        ? trace
        : url.includes('/inventory/summary')
          ? { trackedSkus: 1, availableUnits: 14, openAlerts: 0 }
          : { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <InventoryWorkspace role="STAFF" />
      </QueryProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: /Gloves/ }),
    ).toBeVisible();
    expect(screen.getByText('SO-42')).toHaveAttribute(
      'href',
      '/app/orders?order=order-a',
    );
    expect(
      screen.getAllByRole('link', { name: 'Goods receipt' })[0],
    ).toHaveAttribute('href', '/app/receipts?receipt=receipt-a');
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes(
          '/inventory/products/product-a/trace?reservationsPage=1',
        ),
      ),
    ).toBe(true);
  });
});
