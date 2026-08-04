import { z } from 'zod';

export const MockStorefrontOrderSchema = z.object({
  customer: z.object({
    companyName: z.string().trim().min(2).max(160),
    contactName: z.string().trim().min(1).max(160).optional(),
    email: z.email().max(320).optional(),
    phone: z.string().trim().min(5).max(40).optional(),
  }),
  eventType: z.string().trim().min(1).max(120).default('order.created'),
  externalOrderId: z.string().trim().min(1).max(120),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive().max(1_000_000),
        sku: z.string().trim().min(2).max(64),
      }),
    )
    .min(1)
    .max(200),
  note: z.string().trim().max(1_000).optional(),
});

export type MockStorefrontOrder = z.infer<typeof MockStorefrontOrderSchema>;

export interface WebhookHeaders {
  deliveryId: string;
  organizationSlug: string;
  signature: string;
}

export interface IntegrationListQuery {
  page: number;
  pageSize: number;
  status?: 'RECEIVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | undefined;
}
