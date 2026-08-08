import {
  ProblemDetailsSchema,
  type ProblemDetails,
} from '@stockpilot/contracts';

export class ApiProblem extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiProblem';
    this.problem = problem;
  }

  get code(): string {
    return this.problem.code;
  }

  /** Parses an unknown JSON body into an ApiProblem when it is one. */
  static from(body: unknown): ApiProblem | null {
    const parsed = ProblemDetailsSchema.safeParse(body);
    return parsed.success ? new ApiProblem(parsed.data) : null;
  }
}

let csrfToken: string | null = null;

export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SessionResponse {
  membership: {
    organization: {
      currency: string;
      id: string;
      isDemo?: boolean;
      name: string;
      nextDemoResetAt?: string | null;
      slug?: string;
    };
    role: 'OWNER' | 'MANAGER' | 'STAFF';
  } | null;
  user: { displayName: string; email?: string };
  csrfToken?: string;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  organization: {
    id: string;
    name: string;
    slug: string;
    isDemo: boolean;
  };
}

async function readCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  const body = (await response.json()) as {
    csrfToken?: string;
    detail?: string;
  };
  if (response.status === 401) {
    // No session yet (e.g. the very first signup request): the CSRF guard
    // only needs an Origin check for unauthenticated requests, so no token
    // is required. Do not cache this state — the next request may be
    // authenticated.
    return null;
  }
  if (!response.ok || !body.csrfToken) {
    throw new Error(
      body.detail ?? 'Session expired. Start a fresh demo session.',
    );
  }
  csrfToken = body.csrfToken;
  return body.csrfToken;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await readCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = ProblemDetailsSchema.safeParse(body);
    if (parsed.success) throw new ApiProblem(parsed.data);
    throw new Error('The request could not be completed.');
  }
  return (body ?? {}) as T;
}

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
