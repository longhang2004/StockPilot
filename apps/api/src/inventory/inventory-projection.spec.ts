import { describe, expect, it } from 'vitest';

describe('inventory projection', () => {
  it('applies a receipt without changing reserved stock', async () => {
    const { projectInventory } = await import('./inventory-projection.js');

    expect(
      projectInventory({ onHand: 12, reserved: 4 }, { onHandDelta: 10 }),
    ).toEqual({ available: 18, onHand: 22, reserved: 4 });
  });

  it('rejects any projection that would make stock negative or over-reserved', async () => {
    const { InventoryInvariantError, projectInventory } =
      await import('./inventory-projection.js');

    expect(() =>
      projectInventory({ onHand: 5, reserved: 2 }, { onHandDelta: -6 }),
    ).toThrow(InventoryInvariantError);
    expect(() =>
      projectInventory({ onHand: 5, reserved: 2 }, { reservedDelta: 4 }),
    ).toThrow(InventoryInvariantError);
  });

  it('opens and resolves low-stock alerts only when crossing the threshold', async () => {
    const { lowStockTransition } = await import('./inventory-projection.js');

    expect(lowStockTransition(18, 16, 16)).toBe('OPEN');
    expect(lowStockTransition(16, 12, 16)).toBe('NONE');
    expect(lowStockTransition(12, 20, 16)).toBe('RESOLVE');
    expect(lowStockTransition(20, 18, 16)).toBe('NONE');
  });
});
