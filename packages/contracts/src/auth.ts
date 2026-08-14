import { z } from 'zod';

import { DateTimeSchema, UuidSchema } from './common.js';

export const RoleSchema = z.enum(['OWNER', 'MANAGER', 'STAFF']);
export type Role = z.infer<typeof RoleSchema>;

export const PlanSchema = z.enum(['STARTER', 'PRO']);
export type Plan = z.infer<typeof PlanSchema>;

/** Organization summary embedded in session and workspace responses. */
export const OrganizationBriefSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  currency: z.string(),
  isDemo: z.boolean(),
  nextDemoResetAt: DateTimeSchema.nullable(),
});
export type OrganizationBrief = z.infer<typeof OrganizationBriefSchema>;

/** Workspace membership embedded in session responses. */
export const MembershipSchema = z.object({
  id: UuidSchema,
  role: RoleSchema,
  organization: OrganizationBriefSchema,
});
export type Membership = z.infer<typeof MembershipSchema>;

/** Authenticated user summary embedded in session responses. */
export const UserBriefSchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
  email: z.string(),
});
export type UserBrief = z.infer<typeof UserBriefSchema>;

/** Body returned by login/signup/demo-login/switch-workspace. */
export const AuthSessionResultSchema = z.object({
  membership: MembershipSchema.nullable(),
  user: UserBriefSchema,
  csrfToken: z.string(),
});
export type AuthSessionResult = z.infer<typeof AuthSessionResultSchema>;

/** Body returned by GET /v1/auth/session. */
export const SessionInfoSchema = z.object({
  membership: MembershipSchema.nullable(),
  user: UserBriefSchema,
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

/**
 * Workspace summary returned by GET /v1/auth/workspaces. The API returns
 * membership rows including the organization; this contract documents the
 * fields the workspace shell consumes.
 */
export const WorkspaceSummarySchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  role: RoleSchema,
  organization: z.object({
    id: UuidSchema,
    name: z.string(),
    slug: z.string(),
    isDemo: z.boolean(),
  }),
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
