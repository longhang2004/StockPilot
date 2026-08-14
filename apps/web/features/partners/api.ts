import type { CustomerInput } from '@stockpilot/contracts';

import { apiRequest } from '../../lib/api-client';
import type { PartnerRecord } from '../shared/types';

export type PartnerKind = 'customers' | 'suppliers';

export function savePartner(
  kind: PartnerKind,
  id: string | undefined,
  value: CustomerInput,
): Promise<PartnerRecord> {
  return apiRequest<PartnerRecord>(id ? `/${kind}/${id}` : `/${kind}`, {
    body: JSON.stringify(value),
    method: id ? 'PATCH' : 'POST',
  });
}
