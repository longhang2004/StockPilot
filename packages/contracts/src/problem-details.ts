import { z } from 'zod';

/** RFC 9457 problem-details body with StockPilot extensions. */
export const ProblemDetailsSchema = z.object({
  type: z.url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  instance: z.string().min(1),
  code: z.string().min(1),
  traceId: z.string().min(1),
  errors: z
    .array(
      z.object({
        field: z.string().min(1).optional(),
        message: z.string().min(1),
      }),
    )
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
