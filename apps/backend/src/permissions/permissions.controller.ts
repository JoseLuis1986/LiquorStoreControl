import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { PermissionsService } from './permissions.service';
import {
  SetRolePermissionDto,
  SetUserPermissionDto,
} from './dto/permission.dto';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('catalog')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequirePermissions('permissions:manage')
  catalog() {
    return this.permissions.listCatalog();
  }

  @Get('roles')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequirePermissions('permissions:manage')
  roles(@CurrentUser() user: AuthUserContext) {
    return this.permissions.listRoleMatrix(user.tenantId);
  }

  @Get('me')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
    UserRole.CUSTOMER,
  )
  me(@CurrentUser() user: AuthUserContext) {
    return this.permissions.resolveCodes(user.tenantId, user.id, user.role);
  }

  @Get('users/:userId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequirePermissions('permissions:manage')
  userOverrides(
    @CurrentUser() user: AuthUserContext,
    @Param('userId') userId: string,
  ) {
    return this.permissions.listUserOverrides(user.tenantId, userId);
  }

  @Post('roles')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequirePermissions('permissions:manage')
  setRole(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: SetRolePermissionDto,
  ) {
    return this.permissions.setRolePermission(
      user.tenantId,
      dto.role,
      dto.permissionCode,
      dto.enabled,
    );
  }

  @Post('users')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequirePermissions('permissions:manage')
  setUser(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: SetUserPermissionDto,
  ) {
    return this.permissions.setUserOverride(
      user.tenantId,
      dto.userId,
      dto.permissionCode,
      dto.granted ?? null,
    );
  }
}
