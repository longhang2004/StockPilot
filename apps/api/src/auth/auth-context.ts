import type { Role } from '@stockpilot/contracts';

export interface AuthContext {
  sessionId: string;
  sessionTokenHash: string;
  user: {
    id: string;
    displayName: string;
    email: string;
  };
  membership: {
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
  };
}

export interface AuthenticatedRequest {
  auth: AuthContext;
  cookies: Record<string, string | undefined>;
  get(name: string): string | undefined;
  method: string;
}
