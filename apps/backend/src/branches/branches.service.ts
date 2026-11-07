import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignWarehouseDto,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      include: {
        warehouses: {
          select: { id: true, code: true, name: true, active: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateBranchDto) {
    try {
      return await this.prisma.branch.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          address: dto.address,
        },
        include: { warehouses: true },
      });
    } catch {
      throw new ConflictException('Código de sucursal duplicado');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    const b = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!b) throw new NotFoundException('Sucursal no encontrada');
    return this.prisma.branch.update({
      where: { id },
      data: dto,
      include: { warehouses: true },
    });
  }

  async assignWarehouse(
    tenantId: string,
    branchId: string,
    dto: AssignWarehouseDto,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId },
    });
    if (!wh) throw new NotFoundException('Almacén no encontrado');
    return this.prisma.warehouse.update({
      where: { id: dto.warehouseId },
      data: { branchId },
    });
  }
}
