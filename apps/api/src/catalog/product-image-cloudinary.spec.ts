import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloudinaryMock = vi.hoisted(() => ({
  config: vi.fn(),
  url: vi.fn(() => 'https://res.cloudinary.com/test/image/upload/image.webp'),
  uploader: {
    destroy: vi.fn(),
    upload_stream: vi.fn(),
  },
}));

vi.mock('cloudinary', () => ({ v2: cloudinaryMock }));

import { ServiceUnavailableException } from '@nestjs/common';

import { CloudinaryImageStorage } from './product-image-storage.js';

function environment(configured: boolean) {
  return {
    CLOUDINARY_API_KEY: configured ? 'api-key' : '',
    CLOUDINARY_API_SECRET: configured ? 'api-secret' : '',
    CLOUDINARY_CLOUD_NAME: configured ? 'cloud-name' : '',
    CLOUDINARY_URL: configured
      ? 'cloudinary://api-key:api-secret@cloud-name'
      : '',
    NODE_ENV: 'test',
  } as never;
}

describe('CloudinaryImageStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads with an isolated public id and safe Cloudinary options', async () => {
    const stream = {
      end: vi.fn(),
      on: vi.fn().mockReturnThis(),
    };
    cloudinaryMock.uploader.upload_stream.mockImplementation(
      (
        options: unknown,
        callback: (error: unknown, result?: unknown) => void,
      ) => {
        callback(null, {
          bytes: 120,
          format: 'webp',
          height: 320,
          public_id:
            options && typeof options === 'object' && 'public_id' in options
              ? options.public_id
              : undefined,
          version: 7,
          width: 320,
        });
        return stream;
      },
    );

    const storage = new CloudinaryImageStorage(environment(true));
    const result = await storage.upload({
      buffer: Buffer.from('sanitized'),
      organizationId: 'organization-id',
      productId: 'product-id',
    });

    expect(cloudinaryMock.config).toHaveBeenCalledWith({
      api_key: 'api-key',
      api_secret: 'api-secret',
      cloud_name: 'cloud-name',
      secure: true,
    });
    const options = cloudinaryMock.uploader.upload_stream.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      format: 'webp',
      invalidate: true,
      overwrite: false,
      resource_type: 'image',
    });
    expect(options.public_id).toMatch(
      /^stockpilot\/test\/products\/[0-9a-f-]{36}$/,
    );
    expect(stream.end).toHaveBeenCalledWith(Buffer.from('sanitized'));
    expect(result.publicId).toBe(options.public_id);
  });

  it('invalidates the CDN when deleting an asset', async () => {
    cloudinaryMock.uploader.destroy.mockImplementation(
      (
        _publicId: string,
        _options: unknown,
        callback: (error: unknown, result: unknown) => void,
      ) => callback(null, { result: 'ok' }),
    );
    const storage = new CloudinaryImageStorage(environment(true));

    await storage.destroy('stockpilot/test/products/image-1');

    expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(
      'stockpilot/test/products/image-1',
      { invalidate: true, resource_type: 'image' },
      expect.any(Function),
    );
  });

  it('fails clearly without Cloudinary configuration', async () => {
    const storage = new CloudinaryImageStorage(environment(false));

    await expect(
      Promise.resolve().then(() =>
        storage.upload({
          buffer: Buffer.from('sanitized'),
          organizationId: 'organization-id',
          productId: 'product-id',
        }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('treats a malformed Cloudinary URL as unavailable', async () => {
    const storage = new CloudinaryImageStorage({
      ...environment(false),
      CLOUDINARY_URL: 'not-a-cloudinary-url',
    } as never);

    await expect(
      Promise.resolve().then(() =>
        storage.upload({
          buffer: Buffer.from('sanitized'),
          organizationId: 'organization-id',
          productId: 'product-id',
        }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
