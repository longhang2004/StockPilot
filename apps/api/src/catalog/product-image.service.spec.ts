import { describe, expect, it, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';

import type { AuthContext } from '../auth/auth-context.js';
import type {
  ProductImageStorage,
  StoredProductImage,
} from './product-image-storage.js';

const auth = {
  membership: {
    organization: { id: '08be9205-e340-49df-b1e6-55858ba2207a' },
  },
  user: { id: 'a49ea957-a09c-4eea-a436-6f1910a1f0a4' },
} as AuthContext;

const product = {
  id: '66c12f36-6d4c-4cd3-991d-6d968f7e54ef',
  organizationId: auth.membership.organization.id,
  name: 'Oat Milk',
  sku: 'OAT-1',
  description: null,
  salePrice: { toFixed: () => '8.00' },
  reorderPoint: 1,
  isActive: true,
  imagePublicId: null,
  imageVersion: null,
  imageWidth: null,
  imageHeight: null,
  imageFormat: null,
  imageBytes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stored: StoredProductImage = {
  buffer: Buffer.from('sanitized'),
  bytes: 120,
  format: 'webp',
  height: 320,
  mimeType: 'image/webp',
  publicId: 'stockpilot/test/products/image-1',
  url: 'https://res.cloudinary.com/example/image/upload/c_pad,w_640,h_640/image-1.webp',
  version: 3,
  width: 320,
};

describe('ProductImageService', () => {
  it('destroys a newly uploaded asset when the tenant transaction fails', async () => {
    const storage: ProductImageStorage = {
      destroy: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(stored),
    };
    const transaction = {
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      product: {
        findFirst: vi.fn().mockResolvedValue(product),
        update: vi.fn().mockRejectedValue(new Error('database unavailable')),
      },
    };
    const database = {
      withTenant: vi.fn(async (_context, work) => work(transaction)),
    };
    const { ProductImageService } = await import('./product-image.service.js');
    const service = new ProductImageService(database as never, storage);

    // A valid one-pixel PNG keeps this test independent from client MIME headers.
    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    await expect(
      service.uploadProductImage(auth, product.id, { buffer: onePixelPng }),
    ).rejects.toThrow('database unavailable');
    expect(storage.destroy).toHaveBeenCalledWith(stored.publicId);
  });

  it('keeps the new database reference when old-asset cleanup fails', async () => {
    cloudinary.config({ cloud_name: 'test', secure: true });
    const previous = {
      ...product,
      imageBytes: 100,
      imageFormat: 'webp',
      imageHeight: 320,
      imagePublicId: 'stockpilot/test/products/old-image',
      imageVersion: 2,
      imageWidth: 320,
    };
    const updated = {
      ...product,
      imageBytes: stored.bytes,
      imageFormat: stored.format,
      imageHeight: stored.height,
      imagePublicId: stored.publicId,
      imageVersion: stored.version,
      imageWidth: stored.width,
    };
    const storage: ProductImageStorage = {
      destroy: vi.fn().mockRejectedValue(new Error('CDN timeout')),
      upload: vi.fn().mockResolvedValue(stored),
    };
    const transaction = {
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      product: {
        findFirst: vi.fn().mockResolvedValue(previous),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    const database = {
      withTenant: vi.fn(async (_context, work) => work(transaction)),
    };
    const { ProductImageService } = await import('./product-image.service.js');
    const service = new ProductImageService(database as never, storage);
    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    const result = await service.uploadProductImage(auth, product.id, {
      buffer: onePixelPng,
    });

    expect(result.image?.url).toContain('res.cloudinary.com');
    expect(storage.destroy).toHaveBeenCalledWith(previous.imagePublicId);
    expect(storage.destroy).toHaveBeenCalledTimes(1);
  });
});
