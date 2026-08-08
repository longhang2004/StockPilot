import { ForbiddenException } from '@nestjs/common';
import type { Role } from '@stockpilot/contracts';

export interface MembershipContext {
  id: string;
  role: Role;
  organization: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    isDemo: boolean;
    nextDemoResetAt: Date | null;
  };
}

export interface AuthContext {
  sessionId: string;
  sessionTokenHash: string;
  user: {
    id: string;
    displayName: string;
    email: string;
  };
  /**
   * Null for authenticated users who have not joined a workspace yet
   * (fresh signup, pending invitation acceptance).
   */
  membership: MembershipContext | null;
}

/**
 * Workspace-scoped routes must reject membershipless sessions. Services use
 * this instead of dereferencing `auth.membership` directly so the guard
 * boundary is enforced in one place.
 */
export function requireMembership(auth: AuthContext): MembershipContext {
  if (!auth.membership) {
    throw new ForbiddenException({
      code: 'WORKSPACE_MEMBERSHIP_REQUIRED',
      message: 'A workspace membership is required for this operation.',
    });
  }
  return auth.membership;
}

export interface AuthenticatedRequest {
  auth: AuthContext;
  cookies: Record<string, string | undefined>;
  get(name: string): string | undefined;
  method: string;
}
