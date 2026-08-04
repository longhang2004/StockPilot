import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

export interface TenantContext {
  organizationId: string;
  actorId?: string;
}

export class TenantDatabase {
  constructor(private readonly prisma: PrismaClient) {}

  withTenant<T>(
    context: TenantContext,
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT set_config('app.current_org_id', ${context.organizationId}, true)
      `;
      await transaction.$executeRaw`
        SELECT set_config('app.current_actor_id', ${context.actorId ?? ''}, true)
      `;

      return work(transaction);
    });
  }
}
