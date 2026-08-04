import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CustomerInput,
  ProductInput,
  SupplierInput,
} from '@stockpilot/contracts';

import type { AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import type { Prisma, Product } from '../generated/prisma/client.js';

export interface CatalogListQuery {
  includeInactive: boolean;
  page: number;
  pageSize: number;
  search: string;
}

type LoosePartial<T> = { [Key in keyof T]?: T[Key] | undefined };

export type ProductUpdate = LoosePartial<ProductInput> & {
  isActive?: boolean | undefined;
};
export type PartnerUpdate = LoosePartial<CustomerInput> & {
  isActive?: boolean | undefined;
};

@Injectable()
export class CatalogService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  createProduct(auth: AuthContext, input: ProductInput) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const product = await transaction.product.create({
        data: { ...input, organizationId },
      });
      await recordAudit(transaction, {
        action: 'PRODUCT_CREATED',
        actorUserId: auth.user.id,
        after: serializeProduct(product),
        entityId: product.id,
        entityType: 'Product',
        organizationId,
      });
      return serializeProduct(product);
    });
  }

  listProducts(auth: AuthContext, query: CatalogListQuery) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const where: Prisma.ProductWhereInput = { organizationId };
      if (!query.includeInactive) {
        where.isActive = true;
      }
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      const [items, total] = await Promise.all([
        transaction.product.findMany({
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          where,
        }),
        transaction.product.count({ where }),
      ]);

      return page(items.map(serializeProduct), total, query);
    });
  }

  getProduct(auth: AuthContext, id: string) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const product = await transaction.product.findFirst({
        where: { id, organizationId },
      });
      if (!product) {
        throw new NotFoundException('Product not found.');
      }
      return serializeProduct(product);
    });
  }

  updateProduct(auth: AuthContext, id: string, input: ProductUpdate) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const existing = await transaction.product.findFirst({
        select: { id: true },
        where: { id, organizationId },
      });
      if (!existing) {
        throw new NotFoundException('Product not found.');
      }
      const product = await transaction.product.update({
        data: withoutUndefined(input),
        where: { id },
      });
      await recordAudit(transaction, {
        action: 'PRODUCT_UPDATED',
        actorUserId: auth.user.id,
        after: serializeProduct(product),
        entityId: product.id,
        entityType: 'Product',
        organizationId,
      });
      return serializeProduct(product);
    });
  }

  createCustomer(auth: AuthContext, input: CustomerInput) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const customer = await transaction.customer.create({
        data: { ...input, organizationId },
      });
      await recordAudit(transaction, {
        action: 'CUSTOMER_CREATED',
        actorUserId: auth.user.id,
        after: customer,
        entityId: customer.id,
        entityType: 'Customer',
        organizationId,
      });
      return customer;
    });
  }

  listCustomers(auth: AuthContext, query: CatalogListQuery) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const where = customerWhere(organizationId, query);
      const [items, total] = await Promise.all([
        transaction.customer.findMany({
          orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          where,
        }),
        transaction.customer.count({ where }),
      ]);
      return page(items, total, query);
    });
  }

  getCustomer(auth: AuthContext, id: string) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const customer = await transaction.customer.findFirst({
        where: { id, organizationId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }
      return customer;
    });
  }

  updateCustomer(auth: AuthContext, id: string, input: PartnerUpdate) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const customer = await transaction.customer.findFirst({
        select: { id: true },
        where: { id, organizationId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }
      return transaction.customer
        .update({
          data: withoutUndefined(input),
          where: { id },
        })
        .then(async (customer) => {
          await recordAudit(transaction, {
            action: 'CUSTOMER_UPDATED',
            actorUserId: auth.user.id,
            after: customer,
            entityId: customer.id,
            entityType: 'Customer',
            organizationId,
          });
          return customer;
        });
    });
  }

  createSupplier(auth: AuthContext, input: SupplierInput) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const supplier = await transaction.supplier.create({
        data: { ...input, organizationId },
      });
      await recordAudit(transaction, {
        action: 'SUPPLIER_CREATED',
        actorUserId: auth.user.id,
        after: supplier,
        entityId: supplier.id,
        entityType: 'Supplier',
        organizationId,
      });
      return supplier;
    });
  }

  listSuppliers(auth: AuthContext, query: CatalogListQuery) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const where = supplierWhere(organizationId, query);
      const [items, total] = await Promise.all([
        transaction.supplier.findMany({
          orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          where,
        }),
        transaction.supplier.count({ where }),
      ]);
      return page(items, total, query);
    });
  }

  getSupplier(auth: AuthContext, id: string) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const supplier = await transaction.supplier.findFirst({
        where: { id, organizationId },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found.');
      }
      return supplier;
    });
  }

  updateSupplier(auth: AuthContext, id: string, input: PartnerUpdate) {
    return this.inTenant(auth, async (transaction, organizationId) => {
      const supplier = await transaction.supplier.findFirst({
        select: { id: true },
        where: { id, organizationId },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found.');
      }
      return transaction.supplier
        .update({
          data: withoutUndefined(input),
          where: { id },
        })
        .then(async (supplier) => {
          await recordAudit(transaction, {
            action: 'SUPPLIER_UPDATED',
            actorUserId: auth.user.id,
            after: supplier,
            entityId: supplier.id,
            entityType: 'Supplier',
            organizationId,
          });
          return supplier;
        });
    });
  }

  private inTenant<T>(
    auth: AuthContext,
    work: (
      transaction: Prisma.TransactionClient,
      organizationId: string,
    ) => Promise<T>,
  ): Promise<T> {
    const organizationId = auth.membership.organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) => work(transaction, organizationId),
    );
  }
}

function serializeProduct(product: Product) {
  return { ...product, salePrice: product.salePrice.toFixed(2) };
}

function customerWhere(
  organizationId: string,
  query: CatalogListQuery,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { organizationId };
  if (!query.includeInactive) {
    where.isActive = true;
  }
  if (query.search) {
    where.OR = [
      { companyName: { contains: query.search, mode: 'insensitive' } },
      { contactName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

function supplierWhere(
  organizationId: string,
  query: CatalogListQuery,
): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = { organizationId };
  if (!query.includeInactive) {
    where.isActive = true;
  }
  if (query.search) {
    where.OR = [
      { companyName: { contains: query.search, mode: 'insensitive' } },
      { contactName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

function page<T>(items: T[], total: number, query: CatalogListQuery) {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

function withoutUndefined<T extends object>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter((entry) => entry[1] !== undefined),
  );
}
