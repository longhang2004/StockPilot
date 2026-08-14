import type { ProductInput } from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';
import type { ProductRecord } from '../shared/types';

export const PRODUCTS_RESOURCE = '/products';

/** Update payload: partial product fields (the API rejects an empty body). */
export type ProductUpdateValue = Partial<ProductInput> & {
  isActive?: boolean;
};

export function createProduct(value: ProductInput): Promise<ProductRecord> {
  return apiRequest<ProductRecord>('/products', {
    body: JSON.stringify(value),
    method: 'POST',
  });
}

export function updateProduct(
  id: string,
  value: ProductUpdateValue,
): Promise<ProductRecord> {
  return apiRequest<ProductRecord>(`/products/${id}`, {
    body: JSON.stringify(value),
    method: 'PATCH',
  });
}

export function uploadProductImage(
  id: string,
  file: File,
): Promise<ProductRecord> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<ProductRecord>(`/products/${id}/image`, {
    body,
    method: 'POST',
  });
}

export function deleteProductImage(id: string): Promise<void> {
  return apiRequest<void>(`/products/${id}/image`, { method: 'DELETE' });
}
