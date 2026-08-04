export interface InventoryState {
  onHand: number;
  reserved: number;
}

export interface InventoryDelta {
  onHandDelta?: number;
  reservedDelta?: number;
}

export interface InventoryProjection extends InventoryState {
  available: number;
}

export type LowStockTransition = 'NONE' | 'OPEN' | 'RESOLVE';

export class InventoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryInvariantError';
  }
}

export function projectInventory(
  current: InventoryState,
  delta: InventoryDelta,
): InventoryProjection {
  const onHand = current.onHand + (delta.onHandDelta ?? 0);
  const reserved = current.reserved + (delta.reservedDelta ?? 0);

  if (![onHand, reserved].every(Number.isSafeInteger)) {
    throw new InventoryInvariantError('Inventory quantities must be integers.');
  }
  if (onHand < 0) {
    throw new InventoryInvariantError('On-hand stock cannot be negative.');
  }
  if (reserved < 0 || reserved > onHand) {
    throw new InventoryInvariantError(
      'Reserved stock must stay between zero and on-hand stock.',
    );
  }

  return { available: onHand - reserved, onHand, reserved };
}

export function lowStockTransition(
  previousAvailable: number,
  nextAvailable: number,
  reorderPoint: number,
): LowStockTransition {
  if (previousAvailable > reorderPoint && nextAvailable <= reorderPoint) {
    return 'OPEN';
  }
  if (previousAvailable <= reorderPoint && nextAvailable > reorderPoint) {
    return 'RESOLVE';
  }
  return 'NONE';
}
