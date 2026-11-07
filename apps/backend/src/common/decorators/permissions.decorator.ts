import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../permissions/permission-codes';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...codes: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
