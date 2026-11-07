import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthUserContext } from '../types/auth-user';
import { PermissionsService } from '../../permissions/permissions.service';
import { PermissionCode } from '../../permissions/permission-codes';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUserContext }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('No autenticado');

    for (const code of required) {
      const ok = await this.permissions.userHas(
        user.tenantId,
        user.id,
        user.role,
        code,
      );
      if (!ok) {
        throw new ForbiddenException(`Falta permiso: ${code}`);
      }
    }
    return true;
  }
}
