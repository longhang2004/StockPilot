import { describe, expect, it } from 'vitest';

describe('role permissions', () => {
  it('keeps Staff inside the approved operational boundary', async () => {
    const { can } = await import('./rbac.js');

    expect(can('STAFF', 'order:draft:write')).toBe(true);
    expect(can('STAFF', 'order:fulfill')).toBe(true);
    expect(can('STAFF', 'order:confirm')).toBe(false);
    expect(can('STAFF', 'inventory:adjust')).toBe(false);
  });

  it('allows Manager operations but reserves organization controls for Owner', async () => {
    const { can } = await import('./rbac.js');

    expect(can('MANAGER', 'order:confirm')).toBe(true);
    expect(can('MANAGER', 'inventory:receive')).toBe(true);
    expect(can('MANAGER', 'organization:reset-demo')).toBe(false);
    expect(can('OWNER', 'organization:reset-demo')).toBe(true);
  });

  it('keeps team administration Owner-only', async () => {
    const { can } = await import('./rbac.js');

    expect(can('OWNER', 'team:invite')).toBe(true);
    expect(can('OWNER', 'team:read')).toBe(true);
    expect(can('OWNER', 'team:write')).toBe(true);
    expect(can('MANAGER', 'team:invite')).toBe(false);
    expect(can('MANAGER', 'team:write')).toBe(false);
    expect(can('STAFF', 'team:read')).toBe(false);
  });
});
