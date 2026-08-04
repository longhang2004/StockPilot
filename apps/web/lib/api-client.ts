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
      isDemo?: boolean;
      name: string;
      nextDemoResetAt?: string | null;
      slug?: string;
    };
    role: 'OWNER' | 'MANAGER' | 'STAFF';
  };
  user: { displayName: string; email?: string };
  csrfToken?: string;
}

async function readCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  const body = (await response.json()) as {
    csrfToken?: string;
    detail?: string;
  };
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
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', await readCsrfToken());
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
