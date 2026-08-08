import type { Role } from '@stockpilot/contracts';

export type Permission =
  | 'analytics:read'
  | 'audit:read'
  | 'billing:read'
  | 'billing:write'
  | 'catalog:read'
  | 'catalog:write'
  | 'integration:retry'
  | 'inventory:adjust'
  | 'inventory:read'
  | 'inventory:receive'
  | 'order:cancel'
  | 'order:confirm'
  | 'order:draft:write'
  | 'order:fulfill'
  | 'order:read'
  | 'organization:reset-demo'
  | 'organization:settings:read'
  | 'organization:settings:write'
  | 'team:invite'
  | 'team:read'
  | 'team:write';

const staffPermissions = new Set<Permission>([
  'analytics:read',
  'catalog:read',
  'inventory:read',
  'order:read',
  'order:draft:write',
  'order:fulfill',
]);

const managerPermissions = new Set<Permission>([
  ...staffPermissions,
  'audit:read',
  'catalog:write',
  'integration:retry',
  'inventory:adjust',
  'inventory:receive',
  'order:cancel',
  'order:confirm',
]);

const ownerPermissions = new Set<Permission>([
  ...managerPermissions,
  'billing:read',
  'billing:write',
  'organization:reset-demo',
  'organization:settings:read',
  'organization:settings:write',
  'team:invite',
  'team:read',
  'team:write',
]);

const permissionsByRole: Record<Role, ReadonlySet<Permission>> = {
  MANAGER: managerPermissions,
  OWNER: ownerPermissions,
  STAFF: staffPermissions,
};

export function can(role: Role, permission: Permission): boolean {
  return permissionsByRole[role].has(permission);
}
