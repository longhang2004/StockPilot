import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../lib/query-provider';
import {
  AuditWorkspace,
  IntegrationsWorkspace,
  InventoryWorkspace,
  ImportsWorkspace,
  MoreWorkspace,
  OrdersWorkspace,
  OverviewWorkspace,
  PartnersWorkspace,
  ProductsWorkspace,
  ReceiptsWorkspace,
  SettingsWorkspace,
} from '../components/workflows/operations-workspaces';
import { OrderFormDrawer } from './orders/components/order-form-drawer';
import { ProductsWorkspace as FeatureProductsWorkspace } from './products/products-workspace';

const pageResponse = JSON.stringify({
  items: [],
  page: 1,
  pageSize: 100,
  total: 0,
  totalPages: 0,
});

describe('workspace feature boundaries', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(pageResponse, {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the original workspace barrel exports intact', () => {
    const workspaceExports = [
      AuditWorkspace,
      IntegrationsWorkspace,
      InventoryWorkspace,
      ImportsWorkspace,
      MoreWorkspace,
      OrdersWorkspace,
      OverviewWorkspace,
      PartnersWorkspace,
      ProductsWorkspace,
      ReceiptsWorkspace,
      SettingsWorkspace,
    ];
    for (const workspace of workspaceExports) {
      expect(workspace).toEqual(expect.any(Function));
    }
  });

  it('preserves manager-only catalog actions while staff stays read-only', () => {
    const { unmount } = render(
      <QueryProvider>
        <FeatureProductsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    expect(screen.getByRole('button', { name: /add product/i })).toBeVisible();
    unmount();

    render(
      <QueryProvider>
        <FeatureProductsWorkspace role="STAFF" />
      </QueryProvider>,
    );
    expect(
      screen.queryByRole('button', { name: /add product/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps the order draft form fields and drawer surface intact', () => {
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

    expect(
      screen.getByRole('dialog', { name: 'New draft order' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Customer')).toBeVisible();
    expect(screen.getByLabelText('Product')).toBeVisible();
    expect(screen.getByLabelText('Quantity')).toBeVisible();
    expect(screen.getByLabelText('Note')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeVisible();
  });
});
