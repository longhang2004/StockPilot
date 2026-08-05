import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

import { ENVIRONMENT } from '../config/environment.module.js';
import type { Environment } from '../config/environment.js';

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_DIMENSION = 1600;
export const PRODUCT_IMAGE_MIME_TYPE = 'image/webp' as const;

const MAX_INPUT_PIXELS = 25_000_000;

export interface SanitizedProductImage {
  buffer: Buffer;
  bytes: number;
  height: number;
  mimeType: typeof PRODUCT_IMAGE_MIME_TYPE;
  width: number;
}

export interface StoredProductImage extends SanitizedProductImage {
  format: string;
  publicId: string;
  version: number;
  url: string;
}

interface CloudinaryUploadResult {
  bytes?: number;
  format?: string;
  height?: number;
  public_id?: string;
  version?: number;
  width?: number;
}

interface CloudinaryDestroyResult {
  result?: string;
}

interface CloudinaryConfig {
  api_key: string;
  api_secret: string;
  cloud_name: string;
  secure: true;
}

function parseCloudinaryUrl(value: string): CloudinaryConfig | null {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'cloudinary:' ||
      !parsed.hostname ||
      !parsed.username ||
      !parsed.password
    ) {
      return null;
    }

    return {
      api_key: decodeURIComponent(parsed.username),
      api_secret: decodeURIComponent(parsed.password),
      cloud_name: parsed.hostname,
      secure: true,
    };
  } catch {
    return null;
  }
}

export interface ProductImageStorage {
  upload(input: {
    buffer: Buffer;
    organizationId: string;
    productId: string;
  }): Promise<StoredProductImage>;
  destroy(publicId: string): Promise<void>;
}

export function productImageUrl(publicId: string, version: number): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        crop: 'pad',
        fetch_format: 'auto',
        height: 640,
        quality: 'auto',
        width: 640,
      },
    ],
    version,
  });
}

export function detectProductImageMimeType(
  buffer: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export async function sanitizeProductImage(
  buffer: Buffer,
): Promise<SanitizedProductImage> {
  if (buffer.length === 0 || buffer.length > PRODUCT_IMAGE_MAX_BYTES) {
    throw new BadRequestException(
      `Product images must be smaller than ${PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024)} MiB.`,
    );
  }

  if (!detectProductImageMimeType(buffer)) {
    throw new BadRequestException(
      'Product images must be JPEG, PNG, or WebP files.',
    );
  }

  try {
    const pipeline = sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Image dimensions are missing.');
    }

    const { data, info } = await pipeline
      .rotate()
      .resize({
        fit: 'inside',
        height: PRODUCT_IMAGE_MAX_DIMENSION,
        withoutEnlargement: true,
        width: PRODUCT_IMAGE_MAX_DIMENSION,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height || !info.size) {
      throw new Error('Sanitized image dimensions are missing.');
    }

    return {
      buffer: data,
      bytes: info.size,
      height: info.height,
      mimeType: PRODUCT_IMAGE_MIME_TYPE,
      width: info.width,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('The product image could not be decoded.');
  }
}

@Injectable()
export class CloudinaryImageStorage implements ProductImageStorage {
  private readonly configured: boolean;

  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {
    const {
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
      CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_URL,
    } = environment;
    let configured = false;

    if (CLOUDINARY_URL) {
      const parsed = parseCloudinaryUrl(CLOUDINARY_URL);
      if (parsed) {
        cloudinary.config(parsed);
        configured = true;
      }
    } else if (
      CLOUDINARY_API_KEY &&
      CLOUDINARY_API_SECRET &&
      CLOUDINARY_CLOUD_NAME
    ) {
      cloudinary.config({
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        cloud_name: CLOUDINARY_CLOUD_NAME,
        secure: true,
      });
      configured = true;
    }

    this.configured = configured;
  }

  upload(input: {
    buffer: Buffer;
    organizationId: string;
    productId: string;
  }): Promise<StoredProductImage> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Product image storage is not configured.',
      );
    }

    const publicId = `stockpilot/${this.environment.NODE_ENV}/products/${randomUUID()}`;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const stream = cloudinary.uploader.upload_stream(
        {
          format: 'webp',
          invalidate: true,
          overwrite: false,
          public_id: publicId,
          resource_type: 'image',
        },
        (error: unknown, result: CloudinaryUploadResult | undefined) => {
          if (error || !result) {
            fail(error ?? new Error('Cloudinary did not return an upload.'));
            return;
          }
          if (
            !result.public_id ||
            !result.width ||
            !result.height ||
            !result.bytes ||
            !result.version
          ) {
            fail(new Error('Cloudinary returned incomplete image metadata.'));
            return;
          }
          settled = true;
          resolve({
            buffer: input.buffer,
            bytes: result.bytes,
            format: result.format || 'webp',
            height: result.height,
            mimeType: PRODUCT_IMAGE_MIME_TYPE,
            publicId: result.public_id,
            url: productImageUrl(result.public_id, result.version),
            version: result.version,
            width: result.width,
          });
        },
      );
      stream.on('error', fail);
      stream.end(input.buffer);
    });
  }

  destroy(publicId: string): Promise<void> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Product image storage is not configured.',
      );
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { invalidate: true, resource_type: 'image' },
        (error: unknown, result: CloudinaryDestroyResult | undefined) => {
          if (error) {
            reject(error);
            return;
          }
          if (result?.result !== 'ok' && result?.result !== 'not found') {
            reject(new Error('Cloudinary could not delete the product image.'));
            return;
          }
          resolve();
        },
      );
    });
  }
}
