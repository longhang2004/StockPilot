import { SetMetadata } from '@nestjs/common';

import type { Permission } from './rbac.js';

export const REQUIRED_PERMISSION = 'stockpilot:required-permission';

export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
