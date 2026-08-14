import { apiRequest, newIdempotencyKey } from '../../lib/api-client';

export const DELIVERIES_RESOURCE = '/integration-deliveries';

export function retryDelivery(id: string): Promise<unknown> {
  return apiRequest(`/integration-deliveries/${id}/retry`, {
    idempotencyKey: newIdempotencyKey('integration-retry'),
    method: 'POST',
  });
}
