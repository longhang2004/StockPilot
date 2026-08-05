import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_DIMENSION,
  detectProductImageMimeType,
  sanitizeProductImage,
} from './product-image-storage.js';

describe('product image sanitization', () => {
  it('accepts JPEG, PNG, and WebP magic bytes only', () => {
    expect(detectProductImageMimeType(Buffer.from([0xff, 0xd8, 0xff]))).toBe(
      'image/jpeg',
    );
    expect(
      detectProductImageMimeType(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    ).toBe('image/png');
    expect(
      detectProductImageMimeType(Buffer.from('RIFFxxxxWEBP', 'ascii')),
    ).toBe('image/webp');
    expect(detectProductImageMimeType(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('decodes, strips metadata, resizes, and emits WebP', async () => {
    const input = await sharp({
      create: {
        channels: 3,
        background: { b: 40, g: 120, r: 220 },
        height: 2000,
        width: 1000,
      },
    })
      .png()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await sanitizeProductImage(input);
    const metadata = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBeLessThanOrEqual(PRODUCT_IMAGE_MAX_DIMENSION);
    expect(result.height).toBeLessThanOrEqual(PRODUCT_IMAGE_MAX_DIMENSION);
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('rejects payloads over five MiB before decoding', async () => {
    await expect(
      sanitizeProductImage(Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1)),
    ).rejects.toThrow(/5 MiB/);
  });

  it('rejects fake MIME payloads and undecodable image bytes', async () => {
    await expect(sanitizeProductImage(Buffer.alloc(0))).rejects.toThrow(
      /5 MiB/,
    );
    await expect(
      sanitizeProductImage(Buffer.from('not an image')),
    ).rejects.toThrow(/JPEG, PNG, or WebP/);
    await expect(
      sanitizeProductImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    ).rejects.toThrow(/could not be decoded/);
  });
});
