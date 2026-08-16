import { HttpException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  verify: vi.fn().mockResolvedValue(true),
}));

const { AuthService } = await import('./auth.service.js');
const { verify } = await import('argon2');
const { AuthThrottleService } = await import('./auth-throttle.service.js');
import type { Environment } from '../config/environment.js';

type ThrottleMock = {
  checkAttempt: ReturnType<typeof vi.fn>;
  clearFailures: ReturnType<typeof vi.fn>;
  recordFailure: ReturnType<typeof vi.fn>;
};

type ThrottleLike = InstanceType<typeof AuthThrottleService> | ThrottleMock;

function createService(
  throttle?: ThrottleLike,
  environmentOverrides: Record<string, unknown> = {},
) {
  const environment = {
    CSRF_SECRET: 'test-csrf-secret-with-at-least-32-characters',
    MAX_ACTIVE_SESSIONS_PER_USER: 10,
    SESSION_TTL_HOURS: 12,
    ...environmentOverrides,
  } as unknown as Environment;
  const prisma = {
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findUnique: vi.fn() },
  };
  const throttler: ThrottleLike =
    throttle ??
    ({
      checkAttempt: vi.fn(),
      clearFailures: vi.fn(),
      recordFailure: vi.fn(),
    } satisfies ThrottleMock);
  const service = new AuthService(
    environment,
    prisma as never,
    {} as never,
    throttler as never,
  );
  return { prisma, service, throttle: throttler };
}

const USER = {
  displayName: 'Owner Person',
  email: 'owner@example.com',
  id: 'user-1',
  memberships: [],
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$real$hash',
};

describe('AuthService.login', () => {
  it('equalizes response time for unknown emails with a dummy hash verify', async () => {
    const { prisma, service, throttle } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login('ghost@example.com', 'any-password', '1.2.3.4'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // The dummy verify runs against a fixed throwaway hash, so the work
    // done resembles the known-user path.
    expect(verify).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'any-password',
    );
    expect(throttle.recordFailure).toHaveBeenCalledWith(
      'ghost@example.com',
      '1.2.3.4',
    );
    expect(throttle.clearFailures).not.toHaveBeenCalled();
  });

  it('records failures for wrong passwords without leaking which field failed', async () => {
    const { prisma, service, throttle } = createService();
    prisma.user.findUnique.mockResolvedValue(USER);
    vi.mocked(verify).mockResolvedValueOnce(false);

    await expect(
      service.login('owner@example.com', 'wrong-password', '1.2.3.4'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verify).toHaveBeenCalledWith(USER.passwordHash, 'wrong-password');
    expect(throttle.recordFailure).toHaveBeenCalledWith(
      'owner@example.com',
      '1.2.3.4',
    );
  });

  it('clears prior failures on a successful sign-in', async () => {
    const { prisma, service, throttle } = createService();
    prisma.user.findUnique.mockResolvedValue(USER);

    const result = await service.login(
      'owner@example.com',
      'correct-password',
      '1.2.3.4',
    );

    expect(throttle.clearFailures).toHaveBeenCalledWith(
      'owner@example.com',
      '1.2.3.4',
    );
    expect(throttle.recordFailure).not.toHaveBeenCalled();
    expect(prisma.session.create).toHaveBeenCalledOnce();
    expect(result.rawToken).toEqual(expect.any(String));
    expect(result.context.user.email).toBe('owner@example.com');
  });

  it('rejects blocked pairs before any database lookup or hash work', async () => {
    const throttler = new AuthThrottleService({
      AUTH_FAILURE_BLOCK_MINUTES: 15,
      AUTH_FAILURE_LIMIT: 1,
      AUTH_FAILURE_WINDOW_MINUTES: 15,
    } as unknown as Environment);
    throttler.recordFailure('owner@example.com', '1.2.3.4');
    const { prisma, service } = createService(throttler);

    try {
      await service.login('owner@example.com', 'any-password', '1.2.3.4');
      expect.unreachable('expected a 429 rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('drops expired sessions and revokes the oldest beyond the per-user cap', async () => {
    const { prisma, service } = createService(undefined, {
      MAX_ACTIVE_SESSIONS_PER_USER: 2,
    });
    prisma.session.deleteMany.mockResolvedValue({ count: 4 });
    prisma.session.findMany.mockResolvedValue([
      { id: 'old-1' },
      { id: 'old-2' },
      { id: 'active-1' },
    ]);
    prisma.user.findUnique.mockResolvedValue(USER);

    await service.login('owner@example.com', 'correct-password', '1.2.3.4');

    // Expired rows are purged before the count.
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
        userId: 'user-1',
      },
    });
    // With a cap of 2 and 3 active sessions, only the oldest is revoked…
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: { id: { in: ['old-1'] } },
    });
    // …and the new session is still created.
    expect(prisma.session.create).toHaveBeenCalledOnce();
  });
});
