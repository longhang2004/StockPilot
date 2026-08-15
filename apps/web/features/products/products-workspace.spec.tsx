import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../lib/query-provider';
import { ProductsWorkspace } from './products-workspace';

const productPage = (products: unknown[]) =>
  JSON.stringify({
    items: products,
    page: 1,
    pageSize: 100,
    total: products.length,
    totalPages: 1,
  });

const withImage = {
  description: null,
  id: 'product-tape',
  image: {
    format: 'webp',
    height: 320,
    url: 'https://res.cloudinary.com/example/image/upload/v1/stockpilot/test/products/tape.webp',
    width: 320,
  },
  isActive: true,
  name: 'Packing Tape',
  reorderPoint: 5,
  salePrice: '4.25',
  sku: 'PCK-TAPE',
};

const withoutImage = {
  description: null,
  id: 'product-gloves',
  image: null,
  isActive: true,
  name: 'Nitrile Gloves L',
  reorderPoint: 10,
  salePrice: '8.50',
  sku: 'NTR-GLV-L',
};

describe('ProductsWorkspace product imagery', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/products')
          ? productPage([withImage, withoutImage])
          : '{}';
        return Promise.resolve(
          new Response(body, {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the real product image thumbnail next to the name', async () => {
    render(
      <QueryProvider>
        <ProductsWorkspace role="MANAGER" />
      </QueryProvider>,
    );

    // The responsive table renders both a desktop table and a CSS-hidden
    // mobile card list, so each product cell appears twice in the DOM.
    await screen.findAllByText('Packing Tape');
    const thumbnails = document.querySelectorAll('.product-thumbnail-inline');
    expect(thumbnails).toHaveLength(2);
    for (const thumbnail of Array.from(thumbnails)) {
      expect(thumbnail).toHaveAttribute(
        'src',
        expect.stringContaining(
          encodeURIComponent('res.cloudinary.com/example/image'),
        ) as unknown as string,
      );
      expect(thumbnail).toHaveAttribute('alt', '');
    }
  });

  it('renders only the product name when no image exists (no placeholder)', async () => {
    render(
      <QueryProvider>
        <ProductsWorkspace role="MANAGER" />
      </QueryProvider>,
    );

    await screen.findAllByText('Nitrile Gloves L');
    // Exactly one thumbnail per rendered view (desktop table + mobile card
    // list) — only for the imaged product. No placeholder boxes, dash
    // marks, or icon-only cells for the image-less product.
    expect(document.querySelectorAll('.product-thumbnail-inline')).toHaveLength(
      2,
    );
    expect(
      document.querySelectorAll('.product-thumbnail-placeholder'),
    ).toHaveLength(0);
    for (const name of screen.getAllByText('Nitrile Gloves L')) {
      expect(name.parentElement?.querySelector('img')).toBeNull();
      expect(name.parentElement?.textContent).toBe('Nitrile Gloves L');
    }
  });
});
