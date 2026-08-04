'use client';

import { type QueryClient, useQuery } from '@tanstack/react-query';

import { apiRequest, type PageResponse } from '../lib/api-client';

export function usePage<T>(path: string) {
  return useQuery({
    queryKey: ['page', path],
    queryFn: () => apiRequest<PageResponse<T>>(path),
  });
}

export function invalidatePageQueries(
  queryClient: QueryClient,
  resourcePath: string,
) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const [scope, path] = queryKey;
      return (
        scope === 'page' &&
        typeof path === 'string' &&
        (path === resourcePath || path.startsWith(`${resourcePath}?`))
      );
    },
  });
}
