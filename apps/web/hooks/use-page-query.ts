'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest, type PageResponse } from '../lib/api-client';

export function usePage<T>(path: string) {
  return useQuery({
    queryKey: ['page', path],
    queryFn: () => apiRequest<PageResponse<T>>(path),
  });
}
