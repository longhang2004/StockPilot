import { describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../auth/auth-context.js';

const auth = {
  membership: {
    organization: { id: '08be9205-e340-49df-b1e6-55858ba2207a' },
  },
  user: { id: 'a49ea957-a09c-4eea-a436-6f1910a1f0a4' },
} as AuthContext;

describe('CatalogService', () => {
  it('writes normalized products inside the authenticated tenant transaction', async () => {
    const { CatalogService } = await import('./catalog.service.js');
    const product = {
      create: vi.fn().mockResolvedValue({
        id: 'product-id',
        name: 'Organic Oat Milk',
        salePrice: { toFixed: () => '42.50' },
        sku: 'OAT-12',
      }),
    };
    const auditEvent = { create: vi.fn() };
    const withTenant = vi.fn(async (_context, work) =>
      work({ auditEvent, product }),
    );
    const service = new CatalogService({ withTenant } as never);

    const result = await service.createProduct(auth, {
      description: null,
      name: 'Organic Oat Milk',
      reorderPoint: 16,
      salePrice: '42.50',
      sku: 'OAT-12',
    });

    expect(withTenant).toHaveBeenCalledWith(
      {
        actorId: auth.user.id,
        organizationId: auth.membership.organization.id,
      },
      expect.any(Function),
    );
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: auth.membership.organization.id,
        sku: 'OAT-12',
      }),
    });
    expect(result.salePrice).toBe('42.50');
  });

  it('uses stable pagination and tenant-scoped search', async () => {
    const { CatalogService } = await import('./catalog.service.js');
    const product = {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'product-id',
          name: 'Organic Oat Milk',
          salePrice: { toFixed: () => '42.50' },
          sku: 'OAT-12',
        },
      ]),
    };
    const withTenant = vi.fn(async (_context, work) => work({ product }));
    const service = new CatalogService({ withTenant } as never);

    const result = await service.listProducts(auth, {
      includeInactive: false,
      page: 2,
      pageSize: 25,
      search: 'oat',
    });

    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 25,
        take: 25,
        where: {
          isActive: true,
          organizationId: auth.membership.organization.id,
          OR: [
            { name: { contains: 'oat', mode: 'insensitive' } },
            { sku: { contains: 'oat', mode: 'insensitive' } },
          ],
        },
      }),
    );
    expect(result).toMatchObject({ page: 2, pageSize: 25, total: 1 });
  });
});
