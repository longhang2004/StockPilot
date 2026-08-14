import { RoleSchema } from '@stockpilot/contracts';
import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const SignupInputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
});

export const DemoLoginInputSchema = z.object({ role: RoleSchema });

export const SwitchWorkspaceInputSchema = z.object({
  organizationId: z.uuid(),
});
