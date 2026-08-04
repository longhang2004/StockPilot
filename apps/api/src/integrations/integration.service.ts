import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import type { AuthContext } from '../auth/auth-context.js';
import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';
import { TenantDatabase } from '../database/tenant-database.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { executeIdempotent } from '../idempotency/idempotency.js';
import { recordAudit } from '../audit/audit-record.js';
import {
  JobRunnerService,
  type IntegrationRetryJob,
} from '../jobs/job-runner.service.js';

export const MockStorefrontOrderSchema = z.object({
  customer: z.object({
    companyName: z.string().trim().min(2).max(160),
    contactName: z.string().trim().min(1).max(160).optional(),
    email: z.email().max(320).optional(),
    phone: z.string().trim().min(5).max(40).optional(),
  }),
  eventType: z.string().trim().min(1).max(120).default('order.created'),
  externalOrderId: z.string().trim().min(1).max(120),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive().max(1_000_000),
        sku: z.string().trim().min(2).max(64),
      }),
    )
    .min(1)
    .max(200),
  note: z.string().trim().max(1_000).optional(),
});
export type MockStorefrontOrder = z.infer<typeof MockStorefrontOrderSchema>;

export interface WebhookHeaders {
  deliveryId: string;
  organizationSlug: string;
  signature: string;
}

export interface IntegrationListQuery {
  page: number;
  pageSize: number;
  status?: 'RECEIVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | undefined;
}

@Injectable()
export class IntegrationService {
  constructor(
    @Inject(ENVIRONMENT) private readonly environment: Environment,
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobRunnerService) private readonly jobs: JobRunnerService,
  ) {
    this.jobs.registerIntegrationRetryHandler((job) =>
      this.retryQueuedDelivery(job),
    );
  }

  receiveMockStorefrontOrder(
    headers: WebhookHeaders,
    payload: MockStorefrontOrder,
  ) {
    this.verifySignature(payload, headers.signature);
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
        return this.processExternalDelivery(
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
              this.retryDeliveryTransaction(
                transaction,
                organizationId,
                auth.user.id,
                id,
              ),
          }),
      )
      .then((result) => result.body);
  }

  private async retryQueuedDelivery(job: IntegrationRetryJob): Promise<void> {
    const result = await this.database.withTenant(
      { actorId: job.actorUserId, organizationId: job.organizationId },
      (transaction) =>
        this.retryDeliveryTransaction(
          transaction,
          job.organizationId,
          job.actorUserId,
          job.deliveryId,
        ),
    );
    if (result.status === 'FAILED') {
      throw new Error(result.error ?? 'Integration retry failed.');
    }
  }

  private async retryDeliveryTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    id: string,
  ) {
    const delivery = await transaction.integrationDelivery.findFirst({
      where: { id, organizationId },
    });
    if (!delivery)
      throw new NotFoundException('Integration delivery not found.');
    if (delivery.status === 'SUCCEEDED') {
      return {
        duplicate: true,
        orderId: delivery.salesOrderId,
        status: delivery.status,
      } as const;
    }
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
      const order = await this.createDraftOrder(
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
        error instanceof Error
          ? error.message
          : 'Integration processing failed.';
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

  private processExternalDelivery(
    organizationId: string,
    actorUserId: string,
    deliveryId: string,
    payload: MockStorefrontOrder,
  ) {
    return this.database
      .withTenant(
        { actorId: actorUserId, organizationId },
        async (transaction) =>
          executeIdempotent(transaction, {
            key: deliveryId,
            organizationId,
            payload,
            responseStatus: 202,
            scope: 'webhook:mock-storefront:order',
            work: async () => {
              const existing = await transaction.integrationDelivery.findUnique(
                {
                  where: {
                    organizationId_externalDeliveryId: {
                      externalDeliveryId: deliveryId,
                      organizationId,
                    },
                  },
                },
              );
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
                const order = await this.createDraftOrder(
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

  private verifySignature(payload: MockStorefrontOrder, signature: string) {
    const candidate = signature.replace(/^sha256=/, '').trim();
    const expected = createHmac(
      'sha256',
      this.environment.WEBHOOK_SIGNING_SECRET,
    )
      .update(JSON.stringify(payload))
      .digest('hex');
    const candidateBuffer = Buffer.from(candidate, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      candidateBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(candidateBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Webhook signature is invalid.');
    }
  }

  private async createDraftOrder(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    payload: MockStorefrontOrder,
  ) {
    const warehouse = await transaction.warehouse.findUnique({
      where: { organizationId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found.');
    const skus = payload.items.map((item) => item.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new ConflictException('Webhook order contains duplicate SKUs.');
    }
    const products = await transaction.product.findMany({
      where: { isActive: true, organizationId, sku: { in: skus } },
    });
    const productsBySku = new Map(
      products.map((product) => [product.sku, product]),
    );
    if (products.length !== skus.length) {
      const missing = skus.filter((sku) => !productsBySku.has(sku));
      throw new NotFoundException(`Unknown SKU(s): ${missing.join(', ')}.`);
    }
    const existingCustomer = payload.customer.email
      ? await transaction.customer.findFirst({
          where: {
            email: payload.customer.email,
            isActive: true,
            organizationId,
          },
        })
      : null;
    const customer =
      existingCustomer ??
      (await transaction.customer.create({
        data: {
          companyName: payload.customer.companyName,
          contactName: payload.customer.contactName ?? null,
          email: payload.customer.email ?? null,
          organizationId,
          phone: payload.customer.phone ?? null,
        },
      }));
    const subtotal = payload.items.reduce((sum, item) => {
      const product = productsBySku.get(item.sku.toUpperCase());
      return sum + Number(product?.salePrice ?? 0) * item.quantity;
    }, 0);
    const order = await transaction.salesOrder.create({
      data: {
        createdByUserId: actorUserId,
        customerCompanyName: customer.companyName,
        customerContactName: customer.contactName,
        customerEmail: customer.email,
        customerId: customer.id,
        note: payload.note ?? null,
        orderNumber: `STORE-${payload.externalOrderId}-${Date.now()}`.slice(
          0,
          80,
        ),
        organizationId,
        status: 'DRAFT',
        subtotal: subtotal.toFixed(2),
        warehouseId: warehouse.id,
      },
    });
    for (const item of payload.items) {
      const product = productsBySku.get(item.sku.toUpperCase());
      if (!product) throw new NotFoundException(`Unknown SKU: ${item.sku}.`);
      await transaction.salesOrderLine.create({
        data: {
          lineTotal: (Number(product.salePrice) * item.quantity).toFixed(2),
          organizationId,
          productId: product.id,
          productNameSnapshot: product.name,
          quantity: item.quantity,
          salesOrderId: order.id,
          skuSnapshot: product.sku,
          unitPrice: product.salePrice,
        },
      });
    }
    await transaction.orderTransition.create({
      data: {
        actorUserId,
        fromStatus: null,
        organizationId,
        salesOrderId: order.id,
        toStatus: 'DRAFT',
      },
    });
    await recordAudit(transaction, {
      action: 'ORDER_CREATED_FROM_INTEGRATION',
      actorUserId,
      after: { orderId: order.id, source: 'mock-storefront' },
      entityId: order.id,
      entityType: 'SalesOrder',
      organizationId,
    });
    return order;
  }
}
