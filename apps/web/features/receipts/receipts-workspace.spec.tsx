import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { ReceiptsWorkspace } from './receipts-workspace';

const emptyPage = JSON.stringify({
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

const supplierPage = JSON.stringify({
  items: [
    {
      id: 'supplier-a',
      companyName: 'Bulk Source Co',
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

describe('ReceiptsWorkspace multi-line receipt entry', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        const detail = url.includes('/receipts/receipt-deep')
          ? {
              id: 'receipt-deep',
              organizationId: 'org',
              warehouseId: 'warehouse',
              supplierId: 'supplier-a',
              supplier: { id: 'supplier-a', companyName: 'Bulk Source Co' },
              receiptNumber: 'GR-204',
              receivedAt: '2026-10-17T00:00:00.000Z',
              note: 'Dock 2',
              actorUserId: null,
              createdAt: '2026-10-17T00:00:00.000Z',
              lineCount: 1,
              totalQuantity: 7,
              lines: [
                {
                  id: 'line-1',
                  goodsReceiptId: 'receipt-deep',
                  productId: 'product-gloves',
                  quantity: 7,
                  unitCost: '3.25',
                  product: { name: 'Nitrile Gloves L', sku: 'NTR-GLV-L' },
                },
              ],
            }
          : null;
        const body = url.includes('/products')
          ? productPage
          : url.includes('/suppliers')
            ? supplierPage
            : (detail ?? emptyPage);
        return Promise.resolve(
          new Response(typeof body === 'string' ? body : JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        );
      }),
    );
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  });

  it('adds receipt lines and computes the total cost', async () => {
    const view = render(
      <QueryProvider>
        <ReceiptsWorkspace role="MANAGER" />
      </QueryProvider>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Receive stock' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Receive stock' }),
    ).toBeVisible();
    await screen.findByText('NTR-GLV-L · Nitrile Gloves L');

    fireEvent.change(screen.getByLabelText('Product for line 1'), {
      target: { value: 'product-gloves' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for line 1'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Unit cost for line 1'), {
      target: { value: '3.25' },
    });
    expect(screen.getAllByText('$32.50').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getByLabelText('Product for line 2')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Product for line 2'), {
      target: { value: 'product-tape' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for line 2'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText('Unit cost for line 2'), {
      target: { value: '1.50' },
    });
    expect(screen.getAllByText('$38.50').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('loads a receipt object from its URL and links its SKU to inventory trace', async () => {
    window.history.replaceState(
      null,
      '',
      '/app/receipts?receipt=receipt-deep&keep=1',
    );
    render(
      <QueryProvider>
        <ReceiptsWorkspace role="STAFF" />
      </QueryProvider>,
    );
    expect(await screen.findByText('GR-204')).toBeVisible();
    expect(screen.getByText('Bulk Source Co')).toBeVisible();
    expect(screen.getByText('Dock 2')).toBeVisible();
    expect(screen.getByRole('link', { name: 'NTR-GLV-L' })).toHaveAttribute(
      'href',
      '/app/inventory?product=product-gloves',
    );
    expect(
      screen.queryByRole('button', { name: /Receive stock/ }),
    ).not.toBeInTheDocument();
  });
});
