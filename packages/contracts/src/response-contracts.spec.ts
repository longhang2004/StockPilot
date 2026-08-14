import { describe, expect, it } from 'vitest';

/**
 * Response contracts must accept exactly what the API serializers emit:
 * ISO-8601 date strings, two-decimal money strings, nullable snapshots, and
 * pagination envelopes. These tests pin the wire shapes so the OpenAPI
 * projection and the web client's read-only types cannot drift from the
 * serializers.
 */
describe('shared response contracts', () => {
  it('accepts the pagination envelope with typed items', async () => {
    const { ProductListSchema } = await import('./catalog.js');
    const list = ProductListSchema.parse({
      items: [
        {
          createdAt: '2026-08-04T03:30:00.000Z',
          description: null,
          id: '1b7c2277-2adc-4277-bdb0-f584b0f764bf',
          image: null,
          isActive: true,
          name: 'Packing Tape 48mm',
          organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
          reorderPoint: 8,
          salePrice: '12.50',
          sku: 'HP-1001',
          updatedAt: '2026-08-04T03:30:00.000Z',
        },
      ],
      page: 1,
      pageSize: 25,
      total: 9,
      totalPages: 1,
    });
    expect(list.items[0]?.salePrice).toBe('12.50');
    expect(() =>
      ProductListSchema.parse({
        items: [{ ...list.items[0]!, salePrice: '12.5' }],
        page: 1,
        pageSize: 25,
        total: 9,
        totalPages: 1,
      }),
    ).toThrow();
  });

  it('accepts the auth session result emitted after login', async () => {
    const { AuthSessionResultSchema, SessionInfoSchema } =
      await import('./auth.js');
    const result = AuthSessionResultSchema.parse({
      csrfToken: 'csrf-abc',
      membership: {
        id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
        organization: {
          currency: 'USD',
          id: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
          isDemo: true,
          name: 'Harbor & Pine Wholesale',
          nextDemoResetAt: '2026-08-04T09:30:00.000Z',
          slug: 'stockpilot-demo',
        },
        role: 'MANAGER',
      },
      user: {
        displayName: 'Morgan Manager',
        email: 'manager@stockpilot-demo.stockpilot.test',
        id: 'c0ffee00-0000-4000-8000-000000000001',
      },
    });
    expect(result.membership?.role).toBe('MANAGER');
    // The session endpoint body has no CSRF token.
    expect(() =>
      SessionInfoSchema.parse({ membership: result.membership, user: result.user }),
    ).not.toThrow();
  });

  it('accepts receipt and adjustment results with balance summaries', async () => {
    const { AdjustmentResultSchema, ReceiptResultSchema } =
      await import('./inventory.js');
    const productId = '1b7c2277-2adc-4277-bdb0-f584b0f764bf';
    const receipt = ReceiptResultSchema.parse({
      actorUserId: 'c0ffee00-0000-4000-8000-000000000001',
      balances: [
        { available: 21, onHand: 25, productId, reserved: 4 },
      ],
      createdAt: '2026-08-04T03:30:00.000Z',
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      lines: [
        {
          goodsReceiptId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
          organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
          productId,
          quantity: 25,
          unitCost: '7.75',
        },
      ],
      note: null,
      organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
      receiptNumber: 'GR-2026-001',
      receivedAt: '2026-08-04T03:30:00.000Z',
      supplierId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
      updatedAt: '2026-08-04T03:30:00.000Z',
      warehouseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
    expect(receipt.balances[0]?.available).toBe(21);

    expect(
      AdjustmentResultSchema.parse({
        balance: { available: 21, onHand: 25, productId, reserved: 4 },
        movement: {
          actorUserId: null,
          createdAt: '2026-08-04T03:30:00.000Z',
          id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
          onHandAfter: 25,
          organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
          productId,
          quantityDelta: 25,
          reason: 'Cycle count correction',
          referenceId: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
          referenceType: 'ADJUSTMENT',
          type: 'ADJUSTMENT_IN',
          warehouseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        },
      }).movement.type,
    ).toBe('ADJUSTMENT_IN');
  });

  it('accepts a sales-order detail with lines and transitions', async () => {
    const { SalesOrderDetailSchema } = await import('./orders.js');
    const detail = SalesOrderDetailSchema.parse({
      cancelledAt: null,
      confirmedAt: '2026-08-04T03:45:00.000Z',
      createdAt: '2026-08-04T03:30:00.000Z',
      createdByUserId: 'c0ffee00-0000-4000-8000-000000000001',
      customerCompanyName: 'Northstar Office Supply',
      customerContactName: 'Avery Chen',
      customerEmail: 'customer-1@harborpine.example',
      customerId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
      fulfilledAt: null,
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      lines: [
        {
          id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
          lineTotal: '50.00',
          organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
          productId: '1b7c2277-2adc-4277-bdb0-f584b0f764bf',
          productNameSnapshot: 'Packing Tape 48mm',
          quantity: 4,
          salesOrderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          skuSnapshot: 'HP-1001',
          unitPrice: '12.50',
        },
      ],
      note: null,
      orderNumber: 'SO-2026-1003',
      organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
      status: 'CONFIRMED',
      subtotal: '50.00',
      transitions: [
        {
          actorUserId: 'c0ffee00-0000-4000-8000-000000000001',
          createdAt: '2026-08-04T03:30:00.000Z',
          fromStatus: null,
          id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
          note: null,
          organizationId: 'eb3d7274-745e-48e6-b82a-2d580b80e235',
          salesOrderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          toStatus: 'DRAFT',
        },
      ],
      updatedAt: '2026-08-04T03:45:00.000Z',
      warehouseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
    expect(detail.lines[0]?.skuSnapshot).toBe('HP-1001');
    expect(detail.transitions[0]?.toStatus).toBe('DRAFT');
  });

  it('accepts billing status, analytics, audit, and integration records', async () => {
    const { BillingStatusViewSchema } = await import('./billing.js');
    expect(
      BillingStatusViewSchema.parse({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        entitlements: { csvImport: true, integrations: true, maxTeamMembers: 10 },
        isDemoBilling: true,
        plan: 'PRO',
        status: 'ACTIVE',
        teamUsage: { limit: 10, members: 3 },
      }).plan,
    ).toBe('PRO');

    const { AnalyticsResponseSchema } = await import('./analytics.js');
    expect(
      AnalyticsResponseSchema.parse({
        averageFulfilledOrderValue: '46.25',
        fulfilledOrderCount: 2,
        fulfilledOrderValue: '92.50',
        lowStockSkuCount: 2,
        ordersByStatus: [{ count: 2, status: 'DRAFT' }],
        topFulfilledProducts: [
          { name: 'Packing Tape 48mm', sku: 'HP-1001', unitsFulfilled: 5 },
        ],
      }).fulfilledOrderCount,
    ).toBe(2);

    const { AuditListSchema } = await import('./audit.js');
    expect(
      AuditListSchema.parse({
        items: [
          {
            action: 'RECEIPT_APPLIED',
            actor: { displayName: 'Morgan Manager' },
            after: { receiptNumber: 'GR-2026-001' },
            before: null,
            createdAt: '2026-08-04T03:30:00.000Z',
            entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            entityType: 'GoodsReceipt',
            id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
          },
        ],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      }).items[0]?.action,
    ).toBe('RECEIPT_APPLIED');

    const { IntegrationDeliveryListSchema } = await import('./integrations.js');
    expect(
      IntegrationDeliveryListSchema.parse({
        items: [
          {
            attempts: 2,
            createdAt: '2026-08-04T03:30:00.000Z',
            eventType: 'order.created',
            externalDeliveryId: 'storefront-demo-failure-001',
            id: 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d',
            lastError: 'Queue worker unavailable',
            payload: { eventType: 'order.created' },
            processedAt: null,
            status: 'FAILED',
          },
        ],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      }).items[0]?.status,
    ).toBe('FAILED');
  });
});
