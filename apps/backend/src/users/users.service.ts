import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        customerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateUserDto) {
    await this.permissions.ensureCatalogAndTenantDefaults(tenantId);
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (exists) throw new ConflictException('Email ya registrado en el tenant');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        customerId: dto.customerId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        customerId: true,
        createdAt: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const data: Record<string, unknown> = {};
    if (dto.fullName != null) data.fullName = dto.fullName;
    if (dto.role != null) data.role = dto.role;
    if (dto.status != null) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        customerId: true,
        createdAt: true,
      },
    });
  }
}
