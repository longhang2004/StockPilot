import type { AnalyticsResponse, OverviewResponse } from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';

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
