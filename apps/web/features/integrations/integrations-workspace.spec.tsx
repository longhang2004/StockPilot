import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { fetchDelivery, retryDelivery } from './api';
import { IntegrationsWorkspace } from './integrations-workspace';

vi.mock('./api', () => ({
  DELIVERIES_RESOURCE: '/integration-deliveries',
  fetchDelivery: vi.fn(),
  retryDelivery: vi.fn(),
}));

const delivery = {
  id: 'delivery-a',
  externalDeliveryId: 'storefront-42',
  eventType: 'order.created',
  status: 'FAILED' as const,
  attempts: 1,
  lastError: 'Unknown SKU',
  payload: { sku: 'MISSING' },
  salesOrderId: null,
  createdAt: '2026-10-17T00:00:00Z',
  processedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [delivery],
            total: 101,
            page: 1,
            pageSize: 25,
            totalPages: 5,
          }),
        ),
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

describe('integration retry feedback', () => {
  it('shows a business failure on HTTP success and refreshes the selected detail', async () => {
    vi.mocked(fetchDelivery)
      .mockResolvedValueOnce(delivery)
      .mockResolvedValue({
        ...delivery,
        attempts: 2,
        lastError: 'Still unknown SKU',
      });
    vi.mocked(retryDelivery).mockResolvedValue({
      status: 'FAILED',
      error: 'Still unknown SKU',
    });
    render(
      <QueryProvider>
        <IntegrationsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    fireEvent.click(
      (
        await screen.findAllByRole('button', { name: 'Open storefront-42' })
      )[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Retry delivery' }),
    );
    await waitFor(() => expect(within(dialog).getByText('2')).toBeVisible());
    expect(screen.getAllByText('Still unknown SKU').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Delivery retry queued.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Delivery processed successfully.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('resolves a URL-selected delivery by ID even when it is outside the visible page', async () => {
    window.history.replaceState(
      null,
      '',
      '/app/integrations?delivery=delivery-beyond-first-page&status=FAILED',
    );
    vi.mocked(fetchDelivery).mockResolvedValue({
      ...delivery,
      id: 'delivery-beyond-first-page',
      externalDeliveryId: 'storefront-101',
    });
    render(
      <QueryProvider>
        <IntegrationsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(await screen.findByText('storefront-101')).toBeVisible();
    expect(fetchDelivery).toHaveBeenCalledWith('delivery-beyond-first-page');
  });

  it('does not load protected delivery data for staff', () => {
    window.history.replaceState(
      null,
      '',
      '/app/integrations?delivery=delivery-a',
    );
    const listFetch = vi.fn();
    vi.stubGlobal('fetch', listFetch);
    render(
      <QueryProvider>
        <IntegrationsWorkspace role="STAFF" />
      </QueryProvider>,
    );
    expect(screen.getByText('Integration access required')).toBeVisible();
    expect(listFetch).not.toHaveBeenCalled();
    expect(fetchDelivery).not.toHaveBeenCalled();
  });

  it('links a succeeded delivery to its created order', async () => {
    window.history.replaceState(
      null,
      '',
      '/app/integrations?delivery=delivery-a',
    );
    vi.mocked(fetchDelivery).mockResolvedValue({
      ...delivery,
      salesOrderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      status: 'SUCCEEDED',
      lastError: null,
    });
    render(
      <QueryProvider>
        <IntegrationsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    const dialog = await screen.findByRole('dialog');
    const link = await within(dialog).findByRole('link', {
      name: 'Open order',
    });
    expect(link).toHaveAttribute(
      'href',
      '/app/orders?order=f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
    // No order link when the delivery never created one.
    vi.mocked(fetchDelivery).mockReset();
    vi.mocked(fetchDelivery).mockResolvedValue(delivery);
    cleanup();
    render(
      <QueryProvider>
        <IntegrationsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    const failedDialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(failedDialog).getByText('Retry delivery')).toBeVisible(),
    );
    expect(
      within(failedDialog).queryByRole('link', { name: 'Open order' }),
    ).toBeNull();
  });
});
