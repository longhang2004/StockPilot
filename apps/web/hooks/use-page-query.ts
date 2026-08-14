'use client';

import { type QueryClient, useQuery } from '@tanstack/react-query';

import { apiRequest, type PageResponse } from '../lib/api-client';

export interface PageParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Builds the query-string suffix for a paginated list path, skipping
 * undefined/false-y values so keys stay minimal.
 */
export function toListPath(resource: string, params: PageParams = {}): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined && entry[1] !== false && entry[1] !== '',
  );
  if (entries.length === 0) return resource;
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${resource}?${query}`;
}

/**
 * Paginated list query with a structured key: `['page', resource, params]`.
 * Caching is per-resource-and-params; invalidation targets the resource
 * prefix instead of matching path strings.
 */
export function usePage<T>(resource: string, params: PageParams = {}) {
  return useQuery({
    queryKey: ['page', resource, params],
    queryFn: () => apiRequest<PageResponse<T>>(toListPath(resource, params)),
  });
}

/**
 * Invalidates every paginated list of a resource (all filter/page combos).
 * The predicate matches the structured `['page', resource, params]` keys, so
 * no path-string prefix matching is involved.
 */
export function invalidatePageQueries(
  queryClient: QueryClient,
  resource: string,
) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === 'page' && queryKey[1] === resource,
  });
}
