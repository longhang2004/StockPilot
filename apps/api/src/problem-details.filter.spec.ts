import { describe, expect, it } from 'vitest';

import { Prisma } from './generated/prisma/client.js';
import { toProblem } from './problem-details.filter.js';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`prisma ${code}`, {
    code,
    clientVersion: '7.9.1',
  });
}

describe('toProblem (Prisma branch)', () => {
  it('maps P2002 to a 409 conflict with conflict-oriented detail', () => {
    const problem = toProblem(prismaError('P2002'), '/v1/orders', 'trace-1');
    expect(problem.status).toBe(409);
    expect(problem.code).toBe('CONFLICT');
    expect(problem.detail).toBe(
      'The request conflicts with the current state of the resource.',
    );
    expect(problem.type).toBe('https://stockpilot.dev/problems/conflict');
  });

  it('maps P2025 to a 404 not-found WITHOUT conflict-oriented detail', () => {
    const problem = toProblem(
      prismaError('P2025'),
      '/v1/orders/123',
      'trace-2',
    );
    expect(problem.status).toBe(404);
    expect(problem.code).toBe('NOT_FOUND');
    expect(problem.detail).toBe('The requested resource does not exist.');
    expect(problem.detail).not.toContain('conflict');
    expect(problem.type).toBe('https://stockpilot.dev/problems/not_found');
    expect(problem.title).toBe('Not found');
  });

  it('maps unknown Prisma codes to a 500 without blaming the request', () => {
    const problem = toProblem(prismaError('P2011'), '/v1/receipts', 'trace-3');
    expect(problem.status).toBe(500);
    expect(problem.code).toBe('DATABASE_ERROR');
    expect(problem.detail).toBe('The request could not be completed.');
    expect(problem.title).toBe('Database error');
  });

  it('always includes instance and traceId for correlation', () => {
    const problem = toProblem(
      prismaError('P2025'),
      '/v1/products/x',
      'trace-4',
    );
    expect(problem.instance).toBe('/v1/products/x');
    expect(problem.traceId).toBe('trace-4');
  });
});
