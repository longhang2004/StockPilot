import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  getSettings(auth: AuthContext) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const [organization, warehouse] = await Promise.all([
          transaction.organization.findUnique({
            select: {
              currency: true,
              id: true,
              isDemo: true,
              name: true,
              nextDemoResetAt: true,
              slug: true,
            },
            where: { id: organizationId },
          }),
          transaction.warehouse.findUnique({
            select: { id: true, name: true },
            where: { organizationId },
          }),
        ]);
        if (!organization) {
          throw new NotFoundException('Organization not found.');
        }
        return { ...organization, warehouse };
      },
    );
  }

  listTeam(auth: AuthContext) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const memberships = await transaction.membership.findMany({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            role: true,
            user: { select: { displayName: true, email: true } },
          },
          where: { organizationId },
        });
        return memberships.map((membership) => ({
          displayName: membership.user.displayName,
          email: membership.user.email,
          id: membership.id,
          role: membership.role,
        }));
      },
    );
  }
}
