import { NotFoundException } from '@nestjs/common';

import { recordAudit } from '../audit/audit-record.js';
import type { TenantDatabase } from '../database/tenant-database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import { createStorefrontDraftOrder } from './storefront-order-draft.js';
import {
  MockStorefrontOrderSchema,
  type MockStorefrontOrder,
} from './integration.types.js';

export async function retryDeliveryTransaction(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  actorUserId: string,
  id: string,
) {
  const delivery = await transaction.integrationDelivery.findFirst({
    where: { id, organizationId },
  });
  if (!delivery) throw new NotFoundException('Integration delivery not found.');
  if (delivery.status === 'SUCCEEDED') {
    return {
      duplicate: true,
      orderId: delivery.salesOrderId,
      status: delivery.status,
    } as const;
  }
  const before = { attempts: delivery.attempts, status: delivery.status };
  const payload = MockStorefrontOrderSchema.parse(delivery.payload);
  await transaction.integrationDelivery.update({
    data: {
      attempts: { increment: 1 },
      lastError: null,
      status: 'PROCESSING',
    },
    where: { id },
  });
  try {
    const order = await createStorefrontDraftOrder(
      transaction,
      organizationId,
      actorUserId,
      payload,
    );
    const updated = await transaction.integrationDelivery.update({
      data: {
        lastError: null,
        processedAt: new Date(),
        salesOrderId: order.id,
        status: 'SUCCEEDED',
      },
      where: { id },
    });
    await recordAudit(transaction, {
      action: 'INTEGRATION_RETRIED',
      actorUserId,
      after: { orderId: order.id },
      before,
      entityId: id,
      entityType: 'IntegrationDelivery',
      organizationId,
    });
    return {
      duplicate: false,
      orderId: order.id,
      status: updated.status,
    } as const;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Integration processing failed.';
    const updated = await transaction.integrationDelivery.update({
      data: { lastError: message.slice(0, 1000), status: 'FAILED' },
      where: { id },
    });
    return {
      duplicate: false,
      error: updated.lastError,
      status: updated.status,
    } as const;
  }
}

export function processExternalDelivery(
  database: TenantDatabase,
  organizationId: string,
  actorUserId: string,
  deliveryId: string,
  payload: MockStorefrontOrder,
) {
  return database
    .withTenant({ actorId: actorUserId, organizationId }, async (transaction) =>
      executeIdempotent(transaction, {
        key: deliveryId,
        organizationId,
        payload,
        responseStatus: 202,
        scope: 'webhook:mock-storefront:order',
        work: async () => {
          const existing = await transaction.integrationDelivery.findUnique({
            where: {
              organizationId_externalDeliveryId: {
                externalDeliveryId: deliveryId,
                organizationId,
              },
            },
          });
          if (existing) {
            return {
              duplicate: true,
              orderId: existing.salesOrderId,
              status: existing.status,
            };
          }
          const delivery = await transaction.integrationDelivery.create({
            data: {
              eventType: payload.eventType,
              externalDeliveryId: deliveryId,
              organizationId,
              payload: payload as unknown as Prisma.InputJsonValue,
              status: 'PROCESSING',
              attempts: 1,
            },
          });
          try {
            const order = await createStorefrontDraftOrder(
              transaction,
              organizationId,
              actorUserId,
              payload,
            );
            const updated = await transaction.integrationDelivery.update({
              data: {
                processedAt: new Date(),
                salesOrderId: order.id,
                status: 'SUCCEEDED',
              },
              where: { id: delivery.id },
            });
            return {
              duplicate: false,
              orderId: order.id,
              status: updated.status,
            };
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Integration processing failed.';
            const updated = await transaction.integrationDelivery.update({
              data: { lastError: message.slice(0, 1000), status: 'FAILED' },
              where: { id: delivery.id },
            });
            return {
              duplicate: false,
              error: updated.lastError,
              status: updated.status,
            };
          }
        },
      }),
    )
    .then((result) => ({
      ...result.body,
      duplicate: result.replayed || result.body.duplicate,
    }));
}
