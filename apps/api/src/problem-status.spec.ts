import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';

import { Prisma } from './generated/prisma/client.js';
import { errorStatusCode } from './problem-status.js';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`prisma ${code}`, {
    code,
    clientVersion: '7.9.1',
  });
}

describe('errorStatusCode', () => {
  it('maps ZodError to 400', () => {
    // Produce a real ZodError through a failed parse.
    let error: unknown;
    try {
      z.string().parse(42);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ZodError);
    expect(errorStatusCode(error)).toBe(400);
  });

  it('maps BadRequestException to 400', () => {
    expect(errorStatusCode(new BadRequestException('nope'))).toBe(400);
  });

  it('maps ConflictException to 409', () => {
    expect(errorStatusCode(new ConflictException('conflict'))).toBe(409);
  });

  it('maps Prisma P2002 to 409', () => {
    expect(errorStatusCode(prismaError('P2002'))).toBe(409);
  });

  it('maps Prisma P2025 to 404', () => {
    expect(errorStatusCode(prismaError('P2025'))).toBe(404);
  });

  it('maps other Prisma errors to 500', () => {
    expect(errorStatusCode(prismaError('P2011'))).toBe(500);
  });

  it('maps unknown errors to 500', () => {
    expect(errorStatusCode(new Error('boom'))).toBe(500);
    expect(errorStatusCode('not even an error')).toBe(500);
    expect(errorStatusCode(undefined)).toBe(500);
  });
});
