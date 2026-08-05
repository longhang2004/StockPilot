import { v2 as cloudinary } from 'cloudinary';
import { describe, expect, it } from 'vitest';

import { serializeProduct, serializeProductAudit } from './catalog-mappers.js';

const baseProduct = {
  id: '66c12f36-6d4c-4cd3-991d-6d968f7e54ef',
  organizationId: '08be9205-e340-49df-b1e6-55858ba2207a',
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

describe('serializeProduct', () => {
  it('returns a nullable image and keeps storage fields private', () => {
    const result = serializeProduct(baseProduct as never);

    expect(result.image).toBeNull();
    expect(result).not.toHaveProperty('imagePublicId');
    expect(result).not.toHaveProperty('imageVersion');
  });

  it('returns only public image metadata when storage fields are complete', () => {
    cloudinary.config({ cloud_name: 'mapper-test', secure: true });
    const result = serializeProduct({
      ...baseProduct,
      imageBytes: 120,
      imageFormat: 'webp',
      imageHeight: 320,
      imagePublicId: 'stockpilot/test/products/image-1',
      imageVersion: 7,
      imageWidth: 320,
    } as never);

    expect(result.image).toMatchObject({
      format: 'webp',
      height: 320,
      width: 320,
    });
    expect(result.image?.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(result).not.toHaveProperty('imagePublicId');
  });

  it('does not persist a derived delivery URL in audit snapshots', () => {
    cloudinary.config({ cloud_name: 'mapper-test', secure: true });
    const result = serializeProductAudit({
      ...baseProduct,
      imageBytes: 120,
      imageFormat: 'webp',
      imageHeight: 320,
      imagePublicId: 'stockpilot/test/products/image-1',
      imageVersion: 7,
      imageWidth: 320,
    } as never);

    expect(result.image).toEqual({ format: 'webp', height: 320, width: 320 });
  });
});
