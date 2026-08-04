import { describe, expect, it, vi } from 'vitest';

const auth = {
  membership: {
    organization: {
      id: 'org-1',
      name: 'Demo Wholesale',
      slug: 'demo',
      currency: 'USD',
      isDemo: true,
      nextDemoResetAt: null,
    },
  },
  user: { id: 'owner-1' },
} as never;

describe('OrganizationService', () => {
  it('returns tenant-scoped settings and canonical active team members', async () => {
    const { OrganizationService } = await import('./organization.service.js');
    const transaction = {
      membership: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'membership-1',
            role: 'OWNER',
            user: { displayName: 'Owner', email: 'owner@example.test' },
          },
        ]),
      },
      organization: {
        findUnique: vi.fn().mockResolvedValue({
          currency: 'USD',
          id: 'org-1',
          isDemo: true,
          name: 'Demo Wholesale',
          nextDemoResetAt: null,
          slug: 'demo',
        }),
      },
      warehouse: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'warehouse-1',
          name: 'Main Warehouse',
        }),
      },
    };
    const database = {
      withTenant: vi.fn((_context, work) => work(transaction)),
    };
    const service = new OrganizationService(database as never);

    await expect(service.getSettings(auth)).resolves.toEqual({
      currency: 'USD',
      id: 'org-1',
      isDemo: true,
      name: 'Demo Wholesale',
      nextDemoResetAt: null,
      slug: 'demo',
      warehouse: { id: 'warehouse-1', name: 'Main Warehouse' },
    });
    await expect(service.listTeam(auth)).resolves.toEqual([
      {
        displayName: 'Owner',
        email: 'owner@example.test',
        id: 'membership-1',
        role: 'OWNER',
      },
    ]);
  });
});
