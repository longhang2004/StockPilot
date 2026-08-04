import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequest } from './auth-context.js';

describe('PermissionGuard', () => {
  it('allows a role with the required permission', async () => {
    const { PermissionGuard } = await import('./permission.guard.js');
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue('catalog:write'),
    };
    const guard = new PermissionGuard(reflector as never);
    const context = executionContextFor('MANAGER');

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('rejects a role outside the required permission boundary', async () => {
    const { PermissionGuard } = await import('./permission.guard.js');
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue('catalog:write'),
    };
    const guard = new PermissionGuard(reflector as never);
    const context = executionContextFor('STAFF');

    expect(() => guard.canActivate(context as never)).toThrow(
      ForbiddenException,
    );
  });
});

function executionContextFor(role: 'MANAGER' | 'STAFF') {
  const request = {
    auth: {
      membership: { role },
    },
  } as AuthenticatedRequest;

  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  };
}
