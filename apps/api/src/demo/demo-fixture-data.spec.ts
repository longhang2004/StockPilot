import { describe, expect, it } from 'vitest';

import {
  balanceQuantities,
  DEMO_FIXTURE_COUNTS,
  fixtureId,
  orderFixtures,
  productFixtures,
  receiptQuantities,
} from './demo-fixture-data.js';

/**
 * The demo fixture is load-bearing: e2e and integration suites assert exact
 * row counts, and the automatic demo reset reseeds by deterministic id.
 * These tests pin the id algorithm and keep the declarations internally
 * consistent so fixture drift fails fast instead of surfacing as an
 * unexplained red integration suite.
 */
describe('demo fixture data', () => {
  it('derives deterministic fixture ids that never change', () => {
    // Golden values: any change to the id algorithm or key namespace breaks
    // idempotent reseeding and any external reference to demo rows.
    expect(
      fixtureId('eb3d7274-745e-48e6-b82a-2d580b80e235', 'product-1'),
    ).toBe('35bb4d3b-394c-5d94-a69d-2c51f083be4d');
    expect(
      fixtureId('eb3d7274-745e-48e6-b82a-2d580b80e235', 'order-draft-1'),
    ).not.toBe(fixtureId('eb3d7274-745e-48e6-b82a-2d580b80e235', 'order-draft-2'));
    // Same key in a different organization must not collide.
    expect(
      fixtureId('00000000-0000-4000-8000-000000000000', 'product-1'),
    ).not.toBe(fixtureId('eb3d7274-745e-48e6-b82a-2d580b80e235', 'product-1'));
  });

  it('keeps declared counts in sync with the fixture arrays', () => {
    expect(productFixtures).toHaveLength(
      DEMO_FIXTURE_COUNTS.activeProducts + DEMO_FIXTURE_COUNTS.inactiveProducts,
    );
    expect(
      productFixtures.filter((product) => product.key !== 'product-9-inactive'),
    ).toHaveLength(DEMO_FIXTURE_COUNTS.activeProducts);
    expect(
      orderFixtures.filter((order) => order.status === 'DRAFT'),
    ).toHaveLength(DEMO_FIXTURE_COUNTS.draftOrders);
    expect(
      orderFixtures.filter((order) => order.status === 'CONFIRMED'),
    ).toHaveLength(DEMO_FIXTURE_COUNTS.confirmedOrders);
    expect(
      orderFixtures.filter((order) => order.status === 'FULFILLED'),
    ).toHaveLength(DEMO_FIXTURE_COUNTS.fulfilledOrders);
    expect(
      orderFixtures.filter((order) => order.status === 'CANCELLED'),
    ).toHaveLength(DEMO_FIXTURE_COUNTS.cancelledOrders);
  });

  it('references only declared products in receipt, balance, and order data', () => {
    const productKeys = new Set(productFixtures.map((product) => product.key));
    const activeProductKeys = new Set(
      productFixtures
        .filter((product) => product.key !== 'product-9-inactive')
        .map((product) => product.key),
    );
    for (const key of Object.keys(receiptQuantities)) {
      expect(activeProductKeys, `receipt references ${key}`).toContain(key);
    }
    for (const key of Object.keys(balanceQuantities)) {
      expect(activeProductKeys, `balance references ${key}`).toContain(key);
    }
    for (const order of orderFixtures) {
      expect(productKeys, `${order.key} references`).toContain(
        order.line.productKey,
      );
    }
  });
});
