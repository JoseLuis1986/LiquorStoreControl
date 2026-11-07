import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PermissionCode,
} from './permission-codes';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCatalogAndTenantDefaults(tenantId: string) {
    for (const p of PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code: p.code },
        create: {
          code: p.code,
          name: p.name,
          module: p.module,
        },
        update: { name: p.name, module: p.module },
      });
    }
    const all = await this.prisma.permission.findMany();
    const byCode = new Map(all.map((p) => [p.code, p.id]));

    for (const [role, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const code of codes) {
        const permissionId = byCode.get(code);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            tenantId_role_permissionId: {
              tenantId,
              role: role as UserRole,
              permissionId,
            },
          },
          create: {
            tenantId,
            role: role as UserRole,
            permissionId,
          },
          update: {},
        });
      }
    }
  }

  listCatalog() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  async listRoleMatrix(tenantId: string) {
    await this.ensureCatalogAndTenantDefaults(tenantId);
    const rows = await this.prisma.rolePermission.findMany({
      where: { tenantId },
      include: { permission: true },
      orderBy: [{ role: 'asc' }, { permission: { code: 'asc' } }],
    });
    return rows;
  }

  async setRolePermission(
    tenantId: string,
    role: UserRole,
    permissionCode: string,
    enabled: boolean,
  ) {
    const permission = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!permission) throw new NotFoundException('Permiso no encontrado');
    if (enabled) {
      return this.prisma.rolePermission.upsert({
        where: {
          tenantId_role_permissionId: {
            tenantId,
            role,
            permissionId: permission.id,
          },
        },
        create: { tenantId, role, permissionId: permission.id },
        update: {},
      });
    }
    await this.prisma.rolePermission.deleteMany({
      where: { tenantId, role, permissionId: permission.id },
    });
    return { ok: true };
  }

  async setUserOverride(
    tenantId: string,
    userId: string,
    permissionCode: string,
    granted: boolean | null,
  ) {
    const permission = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!permission) throw new NotFoundException('Permiso no encontrado');
    if (granted === null) {
      await this.prisma.userPermission.deleteMany({
        where: { tenantId, userId, permissionId: permission.id },
      });
      return { ok: true, cleared: true };
    }
    return this.prisma.userPermission.upsert({
      where: {
        tenantId_userId_permissionId: {
          tenantId,
          userId,
          permissionId: permission.id,
        },
      },
      create: {
        tenantId,
        userId,
        permissionId: permission.id,
        granted,
      },
      update: { granted },
    });
  }

  async resolveCodes(
    tenantId: string,
    userId: string,
    role: UserRole,
  ): Promise<PermissionCode[]> {
    await this.ensureCatalogAndTenantDefaults(tenantId);
    if (role === UserRole.OWNER) {
      return PERMISSIONS.map((p) => p.code);
    }
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { tenantId, role },
      include: { permission: true },
    });
    const codes = new Set(rolePerms.map((r) => r.permission.code));
    const overrides = await this.prisma.userPermission.findMany({
      where: { tenantId, userId },
      include: { permission: true },
    });
    for (const o of overrides) {
      if (o.granted) codes.add(o.permission.code);
      else codes.delete(o.permission.code);
    }
    return [...codes] as PermissionCode[];
  }

  async userHas(
    tenantId: string,
    userId: string,
    role: UserRole,
    code: PermissionCode,
  ) {
    if (role === UserRole.OWNER) return true;
    const codes = await this.resolveCodes(tenantId, userId, role);
    return codes.includes(code);
  }

  listUserOverrides(tenantId: string, userId: string) {
    return this.prisma.userPermission.findMany({
      where: { tenantId, userId },
      include: { permission: true },
    });
  }
}
