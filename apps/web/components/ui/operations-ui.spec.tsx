import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

describe('operations UI primitives', () => {
  afterEach(() => cleanup());

  it('returns focus to the trigger after closing a drawer with Escape', async () => {
    const { Drawer } = await import('./operations-ui');
    function Fixture() {
      return (
        <>
          <button type="button">Open</button>
          <Drawer onClose={() => undefined} open title="Details">
            <button type="button">Inside</button>
          </Drawer>
        </>
      );
    }

    render(<Fixture />);
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Details' }), {
      key: 'Escape',
    });
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeVisible();
  });

  it('announces status badges with text, not color alone', async () => {
    const { StatusBadge } = await import('./operations-ui');
    render(<StatusBadge value="CONFIRMED" />);
    expect(screen.getByText('Confirmed')).toBeVisible();
  });
});
