import { describe, expect, it } from 'vitest';

describe('sales order state machine', () => {
  it('allows only the planned forward and cancellation transitions', async () => {
    const { canTransition, invalidTransitionMessage } =
      await import('./order-state-machine.js');

    expect(canTransition('DRAFT', 'CONFIRMED')).toBe(true);
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('CONFIRMED', 'FULFILLED')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(canTransition('FULFILLED', 'DRAFT')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(invalidTransitionMessage('FULFILLED', 'CANCELLED')).toContain(
      'FULFILLED',
    );
  });
});
