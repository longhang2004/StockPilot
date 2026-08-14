import { z } from 'zod';

import { PlanSchema } from './auth.js';

const SubscriptionStatusSchema = z.enum([
  'ACTIVE',
  'CANCELED',
  'INCOMPLETE',
  'PAST_DUE',
  'TRIALING',
  'UNPAID',
]);

/** Body returned by GET /v1/billing. */
export const BillingStatusViewSchema = z.object({
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.iso.datetime().nullable(),
  entitlements: z.object({
    csvImport: z.boolean(),
    integrations: z.boolean(),
    maxTeamMembers: z.number().int(),
  }),
  isDemoBilling: z.boolean(),
  plan: PlanSchema,
  status: SubscriptionStatusSchema.nullable(),
  teamUsage: z.object({
    limit: z.number().int(),
    members: z.number().int(),
  }),
});
export type BillingStatusView = z.infer<typeof BillingStatusViewSchema>;
