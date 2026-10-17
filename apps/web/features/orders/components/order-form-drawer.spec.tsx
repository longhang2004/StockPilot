import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../../lib/query-provider';
import { OrderFormDrawer } from './order-form-drawer';

const pageResponse = JSON.stringify({
  items: [],
  page: 1,
  pageSize: 100,
  total: 0,
  totalPages: 0,
});

const productPage = JSON.stringify({
  items: [
    {
      id: 'product-gloves',
      sku: 'NTR-GLV-L',
      name: 'Nitrile Gloves L',
      description: null,
      salePrice: '8.50',
      reorderPoint: 10,
      isActive: true,
      image: null,
    },
    {
      id: 'product-tape',
      sku: 'PCK-TAPE',
      name: 'Packing Tape',
      description: null,
      salePrice: '4.25',
      reorderPoint: 5,
      isActive: true,
      image: null,
    },
  ],
  page: 1,
  pageSize: 100,
  total: 2,
  totalPages: 1,
});

const customerPage = JSON.stringify({
  items: [
    {
      id: 'customer-a',
      companyName: 'Acme Supplies',
      contactName: null,
      email: null,
      phone: null,
      isActive: true,
    },
  ],
  page: 1,
  pageSize: 100,
  total: 1,
  totalPages: 1,
});

function stubCatalog(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/products')
      ? productPage
      : url.includes('/customers')
        ? customerPage
        : pageResponse;
    return Promise.resolve(
      new Response(body, {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('OrderFormDrawer multi-line order entry', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('adds and removes lines', async () => {
    stubCatalog();

    const view = render(
      <QueryProvider>
        <OrderFormDrawer
          onClose={() => undefined}
          onSaved={() => undefined}
          open
          push={() => undefined}
        />
      </QueryProvider>,
    );

    expect(await screen.findByLabelText('Product for line 1')).toBeVisible();
    expect(
      screen.queryByLabelText('Product for line 2'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getByLabelText('Product for line 2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove line 2' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(
      screen.queryByLabelText('Product for line 2'),
    ).not.toBeInTheDocument();
    view.unmount();
  });

  it('computes a subtotal across lines from catalog prices', async () => {
    stubCatalog();

    const view = render(
      <QueryProvider>
        <OrderFormDrawer
          onClose={() => undefined}
          onSaved={() => undefined}
          open
          push={() => undefined}
        />
      </QueryProvider>,
    );

    const product1 = await screen.findByLabelText('Product for line 1');
    // Wait for the catalog to load so unit prices are available.
    await screen.findByText('NTR-GLV-L · Nitrile Gloves L');
    fireEvent.change(product1, { target: { value: 'product-gloves' } });
    fireEvent.change(screen.getByLabelText('Quantity for line 1'), {
      target: { value: '20' },
    });
    expect(screen.getByText('$8.50')).toBeVisible();
    expect(screen.getAllByText('$170.00').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    fireEvent.change(screen.getByLabelText('Product for line 2'), {
      target: { value: 'product-tape' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for line 2'), {
      target: { value: '6' },
    });
    expect(screen.getByText('$195.50')).toBeVisible();
    view.unmount();
  });

  it('blocks submission while a line has no product', async () => {
    const fetchMock = stubCatalog();

    const view = render(
      <QueryProvider>
        <OrderFormDrawer
          onClose={() => undefined}
          onSaved={() => undefined}
          open
          push={() => undefined}
        />
      </QueryProvider>,
    );

    await screen.findByLabelText('Product for line 1');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const orderCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/orders'),
    );
    expect(orderCalls).toHaveLength(0);
    view.unmount();
  });

  it('searches products beyond the first page and retains a selected price across searches', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/customers')
        ? customerPage
        : JSON.stringify({
            items: url.includes('search=REMOTE-250')
              ? [
                  {
                    id: 'product-250',
                    sku: 'REMOTE-250',
                    name: 'Remote catalog product',
                    salePrice: '7.50',
                    isActive: true,
                  },
                ]
              : [],
            page: 1,
            pageSize: 25,
            total: url.includes('search=REMOTE-250') ? 1 : 250,
            totalPages: url.includes('search=REMOTE-250') ? 1 : 10,
          });
      return Promise.resolve(new Response(body));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryProvider>
        <OrderFormDrawer
          onClose={() => undefined}
          onSaved={() => undefined}
          open
          push={() => undefined}
        />
      </QueryProvider>,
    );
    fireEvent.change(screen.getByLabelText('Search products'), {
      target: { value: 'REMOTE-250' },
    });
    await screen.findByText('REMOTE-250 · Remote catalog product');
    fireEvent.change(screen.getByLabelText('Product for line 1'), {
      target: { value: 'product-250' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for line 1'), {
      target: { value: '2' },
    });
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Search products'), {
      target: { value: 'another-product' },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('search=another-product'),
        ),
      ).toBe(true),
    );
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Product for line 1')).toHaveValue(
      'product-250',
    );
  });
});
