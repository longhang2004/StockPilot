import type {
  AnalyticsResponse,
  OverviewResponse,
} from '@stockpilot/contracts';

import { type PageParams, toListPath } from '../../hooks/use-page-query';
import { apiRequest, type PageResponse } from '../../lib/api-client';

export const overviewKeys = {
  overview: ['overview'] as const,
  analytics: ['analytics'] as const,
};

export function fetchOverview(): Promise<OverviewResponse> {
  return apiRequest<OverviewResponse>('/dashboard/overview');
}

export function fetchAnalytics(): Promise<AnalyticsResponse> {
  return apiRequest<AnalyticsResponse>('/analytics');
}

export function fetchOverviewPage<T>(
  resource: string,
  params: PageParams,
): Promise<PageResponse<T>> {
  return apiRequest<PageResponse<T>>(toListPath(resource, params));
}
