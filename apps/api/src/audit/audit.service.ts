import { Inject, Injectable } from '@nestjs/common';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';

export interface AuditListQuery {
  page: number;
  pageSize: number;
  entityType?: string | undefined;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  list(auth: AuthContext, query: AuditListQuery) {
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const where: { entityType?: string; organizationId: string } = {
          organizationId,
        };
        if (query.entityType) where.entityType = query.entityType;
        const [items, total] = await Promise.all([
          transaction.auditEvent.findMany({
            include: { actor: { select: { displayName: true } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          transaction.auditEvent.count({ where }),
        ]);
        return {
          items,
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
      },
    );
  }
}
