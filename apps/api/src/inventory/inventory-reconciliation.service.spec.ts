import { describe, expect, it, vi } from 'vitest';

describe('InventoryReconciliationService', () => {
  it('opens one alert for a low balance and does not duplicate an existing alert', async () => {
    const { InventoryReconciliationService } =
      await import('./inventory-reconciliation.service.js');
    const transaction = {
      lowStockAlert: {
        create: vi.fn().mockResolvedValue({ id: 'alert-1' }),
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: 'alert-1',
        }),
        updateMany: vi.fn(),
      },
    };
    const jobs = { registerInventoryReconcileHandler: vi.fn() };
    const service = new InventoryReconciliationService(
      { withTenant: vi.fn() } as never,
      {} as never,
      jobs as never,
    );
    const input = {
      available: 3,
      organizationId: 'org-1',
      productId: 'product-1',
      reorderPoint: 5,
      warehouseId: 'warehouse-1',
    };

    await service.reconcileBalance(transaction as never, input);
    await service.reconcileBalance(transaction as never, input);

    expect(transaction.lowStockAlert.create).toHaveBeenCalledTimes(1);
    expect(transaction.lowStockAlert.updateMany).not.toHaveBeenCalled();
  });

  it('resolves an open alert after inventory recovers', async () => {
    const { InventoryReconciliationService } =
      await import('./inventory-reconciliation.service.js');
    const transaction = {
      lowStockAlert: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'alert-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new InventoryReconciliationService(
      { withTenant: vi.fn() } as never,
      {} as never,
      { registerInventoryReconcileHandler: vi.fn() } as never,
    );

    await service.reconcileBalance(transaction as never, {
      available: 8,
      organizationId: 'org-1',
      productId: 'product-1',
      reorderPoint: 5,
      warehouseId: 'warehouse-1',
    });

    expect(transaction.lowStockAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESOLVED' }),
      }),
    );
  });
});
