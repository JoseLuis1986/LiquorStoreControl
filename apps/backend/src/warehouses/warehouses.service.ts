import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, branchId?: string) {
    return this.prisma.warehouse.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
      include: { branch: true },
      orderBy: { code: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateWarehouseDto) {
    try {
      return await this.prisma.warehouse.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          branchId: dto.branchId,
        },
        include: { branch: true },
      });
    } catch {
      throw new ConflictException('Código de almacén duplicado');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateWarehouseDto) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!wh) throw new NotFoundException('Almacén no encontrado');
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }
}
