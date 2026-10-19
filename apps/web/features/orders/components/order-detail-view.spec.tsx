import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrderDetailView } from './order-detail-view';
import { type OrderDetail } from '../../../features/shared/types';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const detail = {
  cancelledAt: null,
  confirmedAt: null,
  createdAt: '2026-10-17T00:00:00Z',
  createdByName: 'Olivia Owner',
  createdByUserId: 'c0ffee00-0000-4000-8000-000000000001',
  customerCompanyName: 'Northstar Office Supply',
  customerContactName: null,
  customerEmail: null,
  customerId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
  fulfilledAt: null,
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  lines: [],
  note: null,
  orderNumber: 'SO-2026-1003',
  organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
  status: 'DRAFT' as const,
  subtotal: '50.00',
  transitions: [],
  updatedAt: '2026-10-17T00:00:00Z',
  warehouseId: '1f7ac10b-58cc-4372-a567-0e02b2c3d479',
  warehouseName: 'Main Warehouse',
};

function renderDetail(overrides: Partial<OrderDetail> = {}) {
  return render(
    <OrderDetailView
      canEditDraft={false}
      canManage={false}
      detail={{ ...detail, ...overrides }}
      onAction={() => undefined}
      onBack={() => undefined}
      onEdit={() => undefined}
      pending={false}
      role="OWNER"
    />,
  );
}

describe('OrderDetailView order facts', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows business names instead of bare internal IDs', () => {
    renderDetail();
    expect(screen.getByText('Main Warehouse')).toBeVisible();
    expect(screen.getByText('Olivia Owner')).toBeVisible();
    // Internal IDs remain available as the small technical affordance.
    expect(screen.getByText(detail.warehouseId)).toBeVisible();
    expect(screen.getByText(detail.createdByUserId)).toBeVisible();
  });

  it('falls back to an honest unknown state when names are missing', () => {
    renderDetail({ createdByName: null, warehouseName: null });
    expect(screen.getByText('Unknown warehouse')).toBeVisible();
    expect(screen.getByText('Unknown user')).toBeVisible();
  });
});
