import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { requireMembership, type AuthContext } from '../auth/auth-context.js';
import { recordAudit } from '../audit/audit-record.js';
import { TenantDatabase } from '../database/tenant-database.js';
import type { Product } from '../generated/prisma/client.js';
import { serializeProduct, serializeProductAudit } from './catalog-mappers.js';
import { PRODUCT_IMAGE_STORAGE } from './product-image-storage.provider.js';
import {
  type ProductImageStorage,
  sanitizeProductImage,
  type StoredProductImage,
} from './product-image-storage.js';

export interface ProductImageUpload {
  buffer?: Buffer | undefined;
}

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(PRODUCT_IMAGE_STORAGE)
    private readonly storage: ProductImageStorage,
  ) {}

  async uploadProductImage(
    auth: AuthContext,
    productId: string,
    file: ProductImageUpload | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('An image file is required.');
    }

    const organizationId = requireMembership(auth).organization.id;
    const existing = await this.findProduct(auth, productId);
    const sanitized = await sanitizeProductImage(file.buffer);
    let uploaded: StoredProductImage | undefined;
    let committed = false;

    try {
      uploaded = await this.storage.upload({
        buffer: sanitized.buffer,
        organizationId,
        productId,
      });
      const stored = uploaded;

      const updated = await this.database.withTenant(
        { actorId: auth.user.id, organizationId },
        async (transaction) => {
          const product = await transaction.product.update({
            data: imageData(stored),
            where: { id: productId },
          });
          await recordAudit(transaction, {
            action: 'PRODUCT_IMAGE_UPLOADED',
            actorUserId: auth.user.id,
            after: serializeProductAudit(product),
            before: serializeProductAudit(existing),
            entityId: product.id,
            entityType: 'Product',
            organizationId,
          });
          return product;
        },
      );
      committed = true;

      if (
        existing.imagePublicId &&
        existing.imagePublicId !== stored.publicId
      ) {
        try {
          await this.storage.destroy(existing.imagePublicId);
        } catch (error) {
          this.logCleanupWarning(
            'The previous product image could not be removed after replacement.',
            existing.imagePublicId,
            error,
          );
        }
      }

      return serializeProduct(updated);
    } catch (error) {
      if (uploaded && !committed) {
        await this.destroyQuietly(uploaded.publicId);
      }
      throw error;
    }
  }

  async deleteProductImage(auth: AuthContext, productId: string) {
    const organizationId = requireMembership(auth).organization.id;
    const existing = await this.findProduct(auth, productId);
    if (!existing.imagePublicId) return serializeProduct(existing);

    const updated = await this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const product = await transaction.product.update({
          data: imageData(null),
          where: { id: productId },
        });
        await recordAudit(transaction, {
          action: 'PRODUCT_IMAGE_DELETED',
          actorUserId: auth.user.id,
          after: serializeProductAudit(product),
          before: serializeProductAudit(existing),
          entityId: product.id,
          entityType: 'Product',
          organizationId,
        });
        return product;
      },
    );

    try {
      await this.storage.destroy(existing.imagePublicId);
    } catch (error) {
      this.logCleanupWarning(
        'The product image metadata was removed, but the Cloudinary asset could not be deleted.',
        existing.imagePublicId,
        error,
      );
    }

    return serializeProduct(updated);
  }

  private findProduct(auth: AuthContext, productId: string): Promise<Product> {
    const organizationId = requireMembership(auth).organization.id;
    return this.database.withTenant(
      { actorId: auth.user.id, organizationId },
      async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId, organizationId },
        });
        if (!product) throw new NotFoundException('Product not found.');
        return product;
      },
    );
  }

  private async destroyQuietly(publicId: string): Promise<void> {
    try {
      await this.storage.destroy(publicId);
    } catch (error) {
      this.logCleanupWarning(
        'The newly uploaded product image could not be cleaned up after a database failure.',
        publicId,
        error,
      );
    }
  }

  private logCleanupWarning(
    message: string,
    publicId: string,
    error: unknown,
  ): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.warn(`${message} publicId=${publicId} error=${detail}`);
  }
}

function imageData(image: Product | StoredProductImage | null | undefined) {
  if (!image) {
    return {
      imageBytes: null,
      imageHeight: null,
      imageFormat: null,
      imagePublicId: null,
      imageVersion: null,
      imageWidth: null,
    };
  }
  if ('publicId' in image) {
    return {
      imageBytes: image.bytes,
      imageFormat: image.format,
      imageHeight: image.height,
      imagePublicId: image.publicId,
      imageVersion: image.version,
      imageWidth: image.width,
    };
  }
  return {
    imageBytes: image.imageBytes,
    imageFormat: image.imageFormat,
    imageHeight: image.imageHeight,
    imagePublicId: image.imagePublicId,
    imageVersion: image.imageVersion,
    imageWidth: image.imageWidth,
  };
}
