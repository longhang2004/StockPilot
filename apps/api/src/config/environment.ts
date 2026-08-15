import { z } from 'zod';

const EnvironmentSchema = z.object({
  API_INTERNAL_URL: z.url().optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional().or(z.literal('')),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional().or(z.literal('')),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional().or(z.literal('')),
  CLOUDINARY_URL: z.string().trim().min(1).optional().or(z.literal('')),
  CSRF_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DEMO_ORGANIZATION_SLUG: z.string().min(1).default('stockpilot-demo'),
  QUEUE_REQUIRED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  MIGRATION_DATABASE_URL: z.string().min(1).optional().or(z.literal('')),
  QUEUE_DATABASE_URL: z.string().min(1).optional().or(z.literal('')),
  PORT: z.coerce.number().int().positive().default(4000),
  SENTRY_DSN: z.url().optional().or(z.literal('')),
  SESSION_COOKIE_NAME: z.string().min(1).default('stockpilot_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  // Comma-separated CIDRs of reverse proxies allowed to set X-Forwarded-For
  // for rate limiting. Empty (default): trust only the socket peer address.
  TRUSTED_PROXY_CIDRS: z.string().trim().optional().or(z.literal('')),
  STRIPE_SECRET_KEY: z.string().trim().min(1).optional().or(z.literal('')),
  STRIPE_STARTER_PRICE_ID: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('')),
  STRIPE_PRO_PRICE_ID: z.string().trim().min(1).optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().trim().min(1).optional().or(z.literal('')),
  WEB_ORIGIN: z.url(),
  WEBHOOK_SIGNING_SECRET: z.string().min(16),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function parseEnvironment(
  source: Record<string, string | undefined>,
): Environment {
  return EnvironmentSchema.parse(source);
}
