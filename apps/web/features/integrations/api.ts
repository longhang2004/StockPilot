import type {
  IntegrationDeliveryRecord,
  IntegrationDeliveryStatus,
} from '@stockpilot/contracts';
import { apiRequest } from '../../lib/api-client';

export const DELIVERIES_RESOURCE = '/integration-deliveries';

export function fetchDelivery(id: string): Promise<IntegrationDeliveryRecord> {
  return apiRequest(`/integration-deliveries/${id}`);
}

export function retryDelivery(
  id: string,
  idempotencyKey: string,
): Promise<{
  status: IntegrationDeliveryStatus;
  error?: string;
  orderId?: string | null;
}> {
  return apiRequest(`/integration-deliveries/${id}/retry`, {
    idempotencyKey,
    method: 'POST',
  });
}
