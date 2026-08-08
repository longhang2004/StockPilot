import { Inject, Injectable } from '@nestjs/common';
import type {
  CustomerInput,
  ProductInput,
  SupplierInput,
} from '@stockpilot/contracts';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { TenantDatabase } from '../database/tenant-database.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from './customer.service.js';
import type {
  CatalogListQuery,
  PartnerUpdate,
  ProductUpdate,
} from './catalog.types.js';
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from './product.service.js';
import {
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from './supplier.service.js';

export type {
  CatalogListQuery,
  PartnerUpdate,
  ProductUpdate,
} from './catalog.types.js';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
  ) {}

  createProduct(auth: AuthContext, input: ProductInput) {
    return this.inTenant(auth, (transaction, organizationId) =>
      createProduct(transaction, auth, organizationId, input),
    );
  }

  listProducts(auth: AuthContext, query: CatalogListQuery) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listProducts(transaction, organizationId, query),
    );
  }

  getProduct(auth: AuthContext, id: string) {
    return this.inTenant(auth, (transaction, organizationId) =>
      getProduct(transaction, organizationId, id),
    );
  }

  updateProduct(auth: AuthContext, id: string, input: ProductUpdate) {
    return this.inTenant(auth, (transaction, organizationId) =>
      updateProduct(transaction, auth, organizationId, id, input),
    );
  }

  createCustomer(auth: AuthContext, input: CustomerInput) {
    return this.inTenant(auth, (transaction, organizationId) =>
      createCustomer(transaction, auth, organizationId, input),
    );
  }

  listCustomers(auth: AuthContext, query: CatalogListQuery) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listCustomers(transaction, organizationId, query),
    );
  }

  getCustomer(auth: AuthContext, id: string) {
    return this.inTenant(auth, (transaction, organizationId) =>
      getCustomer(transaction, organizationId, id),
    );
  }

  updateCustomer(auth: AuthContext, id: string, input: PartnerUpdate) {
    return this.inTenant(auth, (transaction, organizationId) =>
      updateCustomer(transaction, auth, organizationId, id, input),
    );
  }

  createSupplier(auth: AuthContext, input: SupplierInput) {
    return this.inTenant(auth, (transaction, organizationId) =>
      createSupplier(transaction, auth, organizationId, input),
    );
  }

  listSuppliers(auth: AuthContext, query: CatalogListQuery) {
    return this.inTenant(auth, (transaction, organizationId) =>
      listSuppliers(transaction, organizationId, query),
    );
  }

  getSupplier(auth: AuthContext, id: string) {
    return this.inTenant(auth, (transaction, organizationId) =>
      getSupplier(transaction, organizationId, id),
    );
  }

  updateSupplier(auth: AuthContext, id: string, input: PartnerUpdate) {
    return this.inTenant(auth, (transaction, organizationId) =>
      updateSupplier(transaction, auth, organizationId, id, input),
    );
  }

  private inTenant<T>(
    auth: AuthContext,
    work: (
      transaction: Prisma.TransactionClient,
      organizationId: string,
    ) => Promise<T>,
  ): Promise<T> {
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      (transaction) => work(transaction, organizationId),
    );
  }
}
