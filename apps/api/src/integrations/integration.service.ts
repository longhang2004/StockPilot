import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthContext } from '../auth/auth-context.js';
import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { PrismaService } from '../database/prisma.service.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import { JobRunnerService } from '../jobs/job-runner.service.js';
import {
  processExternalDelivery,
  retryDeliveryTransaction,
} from './integration-delivery.service.js';
import { registerIntegrationRetry } from './integration-retry.service.js';
import {
  type IntegrationListQuery,
  type MockStorefrontOrder,
  type WebhookHeaders,
} from './integration.types.js';
import { verifyStorefrontSignature } from './storefront-signature.js';

export {
  MockStorefrontOrderSchema,
  type IntegrationListQuery,
  type MockStorefrontOrder,
  type WebhookHeaders,
} from './integration.types.js';

@Injectable()
export class IntegrationService {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobRunnerService) private readonly jobs: JobRunnerService,
  ) {
    registerIntegrationRetry(this.jobs, this.database);
  }

  receiveMockStorefrontOrder(
    headers: WebhookHeaders,
    payload: MockStorefrontOrder,
  ) {
    verifyStorefrontSignature(
      payload,
      headers.signature,
      this.environment.WEBHOOK_SIGNING_SECRET,
    );
    return this.prisma.organization
      .findUnique({
        include: {
          memberships: {
            select: { userId: true },
            where: { role: 'OWNER' },
            take: 1,
          },
        },
        where: { slug: headers.organizationSlug },
      })
      .then((organization) => {
        const owner = organization?.memberships[0];
        if (!organization || !owner) {
          throw new NotFoundException('Integration organization not found.');
        }
        return processExternalDelivery(
          this.database,
          organization.id,
          owner.userId,
          headers.deliveryId,
          payload,
        ).then((result) => {
          if (result.status === 'FAILED') {
            void this.jobs.enqueueIntegrationRetry({
              actorUserId: owner.userId,
              deliveryId: headers.deliveryId,
              organizationId: organization.id,
            });
          }
          return result;
        });
      });
  }

  list(auth: AuthContext, query: IntegrationListQuery) {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const where = {
          organizationId,
          ...(query.status ? { status: query.status } : {}),
        };
        const [items, total] = await Promise.all([
          transaction.integrationDelivery.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            where,
          }),
          transaction.integrationDelivery.count({ where }),
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

  retry(auth: AuthContext, id: string, idempotencyKey: string) {
    const organizationId = auth.membership.organization.id;
    return this.database
      .withTenant(
        { actorId: auth.user.id, organizationId },
        async (transaction) =>
          executeIdempotent(transaction, {
            key: idempotencyKey,
            organizationId,
            payload: { id },
            responseStatus: 200,
            scope: 'integration:retry',
            work: () =>
              retryDeliveryTransaction(
                transaction,
                organizationId,
                auth.user.id,
                id,
              ),
          }),
      )
      .then((result) => result.body);
  }
}
