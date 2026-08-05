import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

describe('operations UI primitives', () => {
  afterEach(() => cleanup());

  it('returns focus to the trigger after closing a drawer with Escape', async () => {
    const { Drawer } = await import('./operations-ui');
    function Fixture() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open
          </button>
          <Drawer onClose={() => setOpen(false)} open={open} title="Details">
            <button type="button">Inside</button>
          </Drawer>
        </>
      );
    }

    render(<Fixture />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Details' });
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Details' }), {
      key: 'Escape',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it('keeps keyboard focus inside the drawer while it is open', async () => {
    const { Drawer } = await import('./operations-ui');
    render(
      <Drawer onClose={() => undefined} open title="Focus test">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Drawer>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Focus test' });
    const closeButtons = screen.getAllByRole('button', {
      name: 'Close drawer',
    });
    const actions = screen.getAllByRole('button');
    const lastAction = screen.getByRole('button', { name: 'Last action' });
    lastAction.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).not.toBe(lastAction);
    expect(actions.length).toBeGreaterThan(1);
    expect(closeButtons).toHaveLength(2);
  });

  it('keeps table rows and mobile records keyboard actionable', async () => {
    const { ResponsiveDataTable } = await import('./operations-ui');
    const onRowClick = vi.fn();
    render(
      <ResponsiveDataTable
        ariaLabel="Orders"
        columns={[
          { key: 'orderNumber', label: 'Order' },
          { key: 'status', label: 'Status' },
        ]}
        data={[{ id: 'order-1', orderNumber: 'SO-1001', status: 'Draft' }]}
        getRowLabel={(record) => record.orderNumber}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getByRole('table', { name: 'Orders' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Order' })).toHaveAttribute(
      'scope',
      'col',
    );
    const rowActions = screen.getAllByRole('button', { name: 'Open SO-1001' });
    expect(rowActions).toHaveLength(2);
    rowActions[0]!.focus();
    fireEvent.click(rowActions[0]!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('announces status badges with text, not color alone', async () => {
    const { StatusBadge } = await import('./operations-ui');
    render(<StatusBadge value="CONFIRMED" />);
    expect(screen.getByText('Confirmed')).toBeVisible();
  });
});
