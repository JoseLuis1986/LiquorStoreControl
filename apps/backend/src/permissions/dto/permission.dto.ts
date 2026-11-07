import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class SetRolePermissionDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  permissionCode!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class SetUserPermissionDto {
  @IsUUID()
  userId!: string;

  @IsString()
  permissionCode!: string;

  /** null = limpiar override */
  @IsOptional()
  @IsBoolean()
  granted?: boolean | null;
}
