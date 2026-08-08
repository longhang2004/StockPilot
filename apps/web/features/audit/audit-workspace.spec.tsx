import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { auditChangeEntries, AuditWorkspace } from './audit-workspace';

const eventsPage = JSON.stringify({
  items: [
    {
      id: 'evt-1',
      action: 'ORDER_CONFIRMED',
      entityType: 'SalesOrder',
      entityId: 'order-1042',
      createdAt: '2026-08-08T12:00:00.000Z',
      actor: { displayName: 'Maya Chen' },
      before: { status: 'DRAFT', subtotal: '122.25' },
      after: { status: 'CONFIRMED', reserved: { gloves: 20 } },
    },
  ],
  page: 1,
  pageSize: 100,
  total: 1,
  totalPages: 1,
});

describe('AuditWorkspace detail', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(eventsPage, {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('formats before/after snapshots into human-readable entries', () => {
    expect(
      auditChangeEntries({ status: 'DRAFT', note: '', count: 3, extra: null }),
    ).toEqual([
      { key: 'status', value: 'DRAFT' },
      { key: 'count', value: '3' },
    ]);
    const structured = auditChangeEntries({ reserved: { gloves: 20 } });
    expect(structured[0]?.structured).toBe(true);
    expect(structured[0]?.value).toContain('gloves');
    expect(auditChangeEntries(null)).toEqual([]);
    expect(auditChangeEntries({})).toEqual([]);
  });

  it('shows actor and before/after state in the detail drawer', async () => {
    const view = render(
      <QueryProvider>
        <AuditWorkspace />
      </QueryProvider>,
    );

    const [openRow] = await screen.findAllByRole('button', {
      name: 'Open ORDER_CONFIRMED',
    });
    expect(openRow).toBeDefined();
    fireEvent.click(openRow!);

    const dialog = await screen.findByRole('dialog', {
      name: 'ORDER_CONFIRMED',
    });
    const withinDialog = within(dialog);
    expect(dialog).toBeVisible();
    expect(withinDialog.getByText('Maya Chen')).toBeVisible();
    expect(withinDialog.getByText('SalesOrder · order-1042')).toBeVisible();
    expect(withinDialog.getByText('Before')).toBeVisible();
    expect(withinDialog.getByText('After')).toBeVisible();
    expect(withinDialog.getByText('DRAFT')).toBeVisible();
    expect(withinDialog.getByText('CONFIRMED')).toBeVisible();
    expect(withinDialog.getByText(/gloves/)).toBeVisible();
    view.unmount();
  });
});
